use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
};

use arrow_array::{
    Array, ArrayRef, FixedSizeListArray, Float32Array, Float64Array, RecordBatch, StringArray,
    types::Float32Type,
};
use arrow_schema::{DataType, Field, Schema};
use futures::TryStreamExt;
use lance_index::scalar::FullTextSearchQuery;
use lancedb::{
    Table, connect,
    index::{Index, scalar::FtsIndexBuilder, vector::IvfPqIndexBuilder},
    query::{ExecutableQuery, QueryBase, QueryExecutionOptions, Select},
    table::OptimizeAction,
};

const FORMAT_MARKER: &str = ".zvs-native-index-v1";
const TABLE_PREFIX: &str = "vector_store_";
const VECTOR_INDEX_MIN_ROWS: usize = 20_000;
const MAX_PARTITIONS: usize = 4096;

static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
static STORE_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();
static PREPARED_FOR_WRITE: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

#[derive(Clone, Debug)]
pub struct ChunkRow {
    pub id: String,
    pub document_id: String,
    pub chunk_index: f64,
    pub text: String,
    pub vector: Vec<f32>,
    pub file_name: String,
    pub page_number: f64,
}

#[derive(Clone, Debug)]
pub struct SearchRow {
    pub document_id: String,
    pub file_name: String,
    pub chunk_index: f64,
    pub text: String,
    pub page_number: f64,
    pub score: f64,
}

pub fn initialize(directory: &str) -> Result<bool, String> {
    let directory = PathBuf::from(directory);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Не удалось создать каталог индекса: {error}"))?;
    let marker = directory.join(FORMAT_MARKER);
    if marker.exists() {
        return Ok(false);
    }
    for entry in fs::read_dir(&directory)
        .map_err(|error| format!("Не удалось прочитать каталог индекса: {error}"))?
    {
        let path = entry
            .map_err(|error| format!("Не удалось прочитать индекс: {error}"))?
            .path();
        let is_vector_table = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(TABLE_PREFIX) && name.ends_with(".lance"));
        if is_vector_table {
            fs::remove_dir_all(&path)
                .map_err(|error| format!("Не удалось удалить старый индекс: {error}"))?;
        }
    }
    Ok(true)
}

pub fn complete_initialization(directory: &str) -> Result<(), String> {
    fs::write(PathBuf::from(directory).join(FORMAT_MARKER), b"1")
        .map_err(|error| format!("Не удалось записать версию индекса: {error}"))
}

pub fn append(directory: &str, store_id: &str, rows: Vec<ChunkRow>) -> Result<(), String> {
    if rows.is_empty() {
        return Ok(());
    }
    let dimension = rows[0].vector.len();
    if dimension == 0 || rows.iter().any(|row| row.vector.len() != dimension) {
        return Err("Векторы документа имеют разную или нулевую размерность".to_string());
    }
    serialized(directory, store_id, || {
        runtime().block_on(async {
            let database = connect(directory).execute().await.map_err(display)?;
            let name = table_name(store_id);
            let names = database.table_names().execute().await.map_err(display)?;
            let batch = batch(&rows, dimension)?;
            if !names.contains(&name) {
                database
                    .create_table(&name, batch)
                    .execute()
                    .await
                    .map_err(display)?;
                prepared()
                    .lock()
                    .map_err(poisoned)?
                    .insert(lock_key(directory, store_id));
                return Ok(());
            }
            let table = database
                .open_table(&name)
                .execute()
                .await
                .map_err(display)?;
            prepare_for_write(directory, store_id, &table).await?;
            let ids = rows
                .iter()
                .map(|row| format!("'{}'", sql_literal(&row.document_id)))
                .collect::<HashSet<_>>()
                .into_iter()
                .collect::<Vec<_>>()
                .join(",");
            let predicate = format!("document_id IN ({ids})");
            table.delete(&predicate).await.map_err(display)?;
            table.add(batch).execute().await.map_err(display)?;
            Ok(())
        })
    })
}

pub fn finalize(directory: &str, store_id: &str, hybrid: bool) -> Result<(), String> {
    serialized(directory, store_id, || {
        let result = runtime().block_on(async {
            let Some(table) = open(directory, store_id).await? else {
                return Ok(());
            };
            if hybrid {
                table
                    .create_index(&["text"], Index::FTS(FtsIndexBuilder::default()))
                    .replace(true)
                    .execute()
                    .await
                    .map_err(display)?;
            }
            let count = table.count_rows(None).await.map_err(display)?;
            if count >= VECTOR_INDEX_MIN_ROWS {
                let partitions = (count as f64).sqrt().round() as usize;
                table
                    .create_index(
                        &["vector"],
                        Index::IvfPq(
                            IvfPqIndexBuilder::default()
                                .num_partitions(partitions.clamp(1, MAX_PARTITIONS) as u32),
                        ),
                    )
                    .replace(true)
                    .execute()
                    .await
                    .map_err(display)?;
            }
            table.optimize(OptimizeAction::All).await.map_err(display)?;
            Ok(())
        });
        prepared()
            .lock()
            .map_err(poisoned)?
            .remove(&lock_key(directory, store_id));
        result
    })
}

pub fn remove_document(directory: &str, store_id: &str, document_id: &str) -> Result<(), String> {
    serialized(directory, store_id, || {
        runtime().block_on(async {
            if let Some(table) = open(directory, store_id).await? {
                let predicate = format!("document_id = '{}'", sql_literal(document_id));
                table.delete(&predicate).await.map_err(display)?;
            }
            Ok(())
        })
    })
}

pub fn drop_store(directory: &str, store_id: &str) -> Result<(), String> {
    serialized(directory, store_id, || {
        runtime().block_on(async {
            let database = connect(directory).execute().await.map_err(display)?;
            let name = table_name(store_id);
            if database
                .table_names()
                .execute()
                .await
                .map_err(display)?
                .contains(&name)
            {
                database.drop_table(&name, &[]).await.map_err(display)?;
            }
            prepared()
                .lock()
                .map_err(poisoned)?
                .remove(&lock_key(directory, store_id));
            Ok(())
        })
    })
}

pub fn search(
    directory: &str,
    store_id: &str,
    query_text: &str,
    vector: Vec<f32>,
    hybrid: bool,
    limit: usize,
) -> Result<Vec<SearchRow>, String> {
    serialized(directory, store_id, || {
        runtime().block_on(async {
            let Some(table) = open(directory, store_id).await? else {
                return Ok(Vec::new());
            };
            if hybrid {
                ensure_fts(&table).await?;
            }
            let columns = Select::Columns(vec![
                "document_id".to_string(),
                "file_name".to_string(),
                "chunk_index".to_string(),
                "text".to_string(),
                "page_number".to_string(),
            ]);
            let batches = if hybrid {
                table
                    .query()
                    .full_text_search(FullTextSearchQuery::new(query_text.to_string()))
                    .nearest_to(vector)
                    .map_err(display)?
                    .select(columns)
                    .limit(limit)
                    .execute_hybrid(QueryExecutionOptions::default())
                    .await
                    .map_err(display)?
                    .try_collect::<Vec<_>>()
                    .await
                    .map_err(display)?
            } else {
                table
                    .vector_search(vector)
                    .map_err(display)?
                    .select(columns)
                    .limit(limit)
                    .execute()
                    .await
                    .map_err(display)?
                    .try_collect::<Vec<_>>()
                    .await
                    .map_err(display)?
            };
            decode(batches, hybrid)
        })
    })
}

async fn ensure_fts(table: &Table) -> Result<(), String> {
    let current = table.list_indices().await.map_err(display)?;
    let valid = current.iter().any(|index| {
        index.columns.iter().any(|column| column == "text")
            && index.num_indexed_rows.unwrap_or(0) > 0
            && index.num_unindexed_rows.unwrap_or(0) == 0
    });
    if !valid {
        table
            .create_index(&["text"], Index::FTS(FtsIndexBuilder::default()))
            .replace(true)
            .execute()
            .await
            .map_err(display)?;
    }
    Ok(())
}

async fn prepare_for_write(directory: &str, store_id: &str, table: &Table) -> Result<(), String> {
    let key = lock_key(directory, store_id);
    if prepared().lock().map_err(poisoned)?.contains(&key) {
        return Ok(());
    }
    for index in table.list_indices().await.map_err(display)? {
        if index
            .columns
            .iter()
            .any(|column| column == "text" || column == "vector")
        {
            table.drop_index(&index.name).await.map_err(display)?;
        }
    }
    prepared().lock().map_err(poisoned)?.insert(key);
    Ok(())
}

async fn open(directory: &str, store_id: &str) -> Result<Option<Table>, String> {
    let database = connect(directory).execute().await.map_err(display)?;
    let name = table_name(store_id);
    if !database
        .table_names()
        .execute()
        .await
        .map_err(display)?
        .contains(&name)
    {
        return Ok(None);
    }
    database
        .open_table(&name)
        .execute()
        .await
        .map(Some)
        .map_err(display)
}

fn batch(rows: &[ChunkRow], dimension: usize) -> Result<RecordBatch, String> {
    let schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("document_id", DataType::Utf8, false),
        Field::new("chunk_index", DataType::Float64, false),
        Field::new("text", DataType::Utf8, false),
        Field::new(
            "vector",
            DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float32, true)),
                dimension as i32,
            ),
            false,
        ),
        Field::new("file_name", DataType::Utf8, false),
        Field::new("page_number", DataType::Float64, false),
    ]));
    let vectors = FixedSizeListArray::from_iter_primitive::<Float32Type, _, _>(
        rows.iter()
            .map(|row| Some(row.vector.iter().copied().map(Some).collect::<Vec<_>>())),
        dimension as i32,
    );
    RecordBatch::try_new(
        schema,
        vec![
            Arc::new(StringArray::from_iter_values(
                rows.iter().map(|row| row.id.as_str()),
            )) as ArrayRef,
            Arc::new(StringArray::from_iter_values(
                rows.iter().map(|row| row.document_id.as_str()),
            )),
            Arc::new(Float64Array::from_iter_values(
                rows.iter().map(|row| row.chunk_index),
            )),
            Arc::new(StringArray::from_iter_values(
                rows.iter().map(|row| row.text.as_str()),
            )),
            Arc::new(vectors),
            Arc::new(StringArray::from_iter_values(
                rows.iter().map(|row| row.file_name.as_str()),
            )),
            Arc::new(Float64Array::from_iter_values(
                rows.iter().map(|row| row.page_number),
            )),
        ],
    )
    .map_err(display)
}

fn decode(batches: Vec<RecordBatch>, hybrid: bool) -> Result<Vec<SearchRow>, String> {
    let mut rows = Vec::new();
    for batch in batches {
        let strings = |name: &str| {
            batch
                .column_by_name(name)
                .and_then(|value| value.as_any().downcast_ref::<StringArray>())
                .ok_or_else(|| format!("Индекс не содержит строковое поле {name}"))
        };
        let numbers = |name: &str| {
            batch
                .column_by_name(name)
                .and_then(|value| value.as_any().downcast_ref::<Float64Array>())
                .ok_or_else(|| format!("Индекс не содержит числовое поле {name}"))
        };
        let document_ids = strings("document_id")?;
        let file_names = strings("file_name")?;
        let chunk_indices = numbers("chunk_index")?;
        let texts = strings("text")?;
        let page_numbers = numbers("page_number")?;
        for row in 0..batch.num_rows() {
            let raw_score = numeric(
                &batch,
                if hybrid {
                    "_relevance_score"
                } else {
                    "_distance"
                },
                row,
            )?;
            rows.push(SearchRow {
                document_id: document_ids.value(row).to_string(),
                file_name: file_names.value(row).to_string(),
                chunk_index: chunk_indices.value(row),
                text: texts.value(row).to_string(),
                page_number: page_numbers.value(row),
                score: if hybrid {
                    (raw_score / (2.0 / 60.0)).clamp(0.0, 1.0)
                } else {
                    1.0 / (1.0 + raw_score)
                },
            });
        }
    }
    Ok(rows)
}

fn numeric(batch: &RecordBatch, name: &str, row: usize) -> Result<f64, String> {
    let value = batch
        .column_by_name(name)
        .ok_or_else(|| format!("Индекс не вернул {name}"))?;
    if let Some(values) = value.as_any().downcast_ref::<Float32Array>() {
        return Ok(f64::from(values.value(row)));
    }
    if let Some(values) = value.as_any().downcast_ref::<Float64Array>() {
        return Ok(values.value(row));
    }
    Err(format!("Индекс вернул поле {name} неизвестного типа"))
}

fn serialized<T>(
    directory: &str,
    store_id: &str,
    task: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let lock = {
        let mut locks = STORE_LOCKS
            .get_or_init(|| Mutex::new(HashMap::new()))
            .lock()
            .map_err(poisoned)?;
        locks
            .entry(lock_key(directory, store_id))
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    };
    let _guard = lock.lock().map_err(poisoned)?;
    task()
}

fn runtime() -> &'static tokio::runtime::Runtime {
    RUNTIME.get_or_init(|| tokio::runtime::Runtime::new().expect("Tokio runtime must initialize"))
}

fn prepared() -> &'static Mutex<HashSet<String>> {
    PREPARED_FOR_WRITE.get_or_init(|| Mutex::new(HashSet::new()))
}
fn lock_key(directory: &str, store_id: &str) -> String {
    format!("{directory}:{store_id}")
}
fn table_name(store_id: &str) -> String {
    format!("{TABLE_PREFIX}{store_id}")
}
fn sql_literal(value: &str) -> String {
    value.replace('\'', "''")
}
fn display(error: impl std::fmt::Display) -> String {
    error.to_string()
}
fn poisoned<T>(_: std::sync::PoisonError<T>) -> String {
    "Блокировка индекса повреждена".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_sql_literals() {
        assert_eq!(sql_literal("a'b"), "a''b");
    }

    #[test]
    fn creates_stable_table_names() {
        assert_eq!(table_name("abc"), "vector_store_abc");
    }
}
