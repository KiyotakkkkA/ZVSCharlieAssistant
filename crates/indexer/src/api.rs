use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
};

use napi::{
    Env, Result, Status, Task,
    bindgen_prelude::*,
    threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use napi_derive::napi;

use crate::{
    assets::{AssetProgress, AssetStage, AssetStore, PDFIUM},
    downloads,
    embed::{Embedder, index as vector_index},
    extract::{
        office::{extract_docx, extract_plain},
        pdf::{ExtractRequest, worker},
        route::PageRoute,
    },
    ocr::{OcrEngine, Preference},
    rerank::Reranker,
};

const DEFAULT_RENDER_WIDTH: i32 = 1654;
const MAX_DOCUMENT_BYTES: u64 = 256 * 1024 * 1024;

#[napi(object)]
pub struct AssetPaths {
    pub pdfium: String,
    pub ocr_detection: String,
    pub ocr_recognition: String,
}

#[napi(object)]
pub struct AssetProgressEvent {
    pub key: String,
    pub stage: String,
    pub downloaded: f64,
    pub total: Option<f64>,
    pub percent: Option<f64>,
}

type ProgressCallback =
    ThreadsafeFunction<AssetProgressEvent, (), AssetProgressEvent, Status, false>;

#[napi(object)]
pub struct ExtractedPageResult {
    pub page_number: u32,
    pub text: String,
    pub route: String,
    pub recognised_lines: u32,
}

#[napi(object)]
pub struct ExtractDocumentResult {
    pub pages: Vec<ExtractedPageResult>,
    pub text_layer_pages: u32,
    pub ocr_pages: u32,
    pub empty_pages: u32,
    pub characters: u32,
    pub accelerated: bool,
    pub acceleration_error: Option<String>,
}

#[napi(object)]
pub struct ExtractDocumentRequest {
    pub cache_dir: String,
    pub file_path: String,
    pub render_width: Option<u32>,
    pub recognise_scans: Option<bool>,
    pub provider: Option<String>,
    pub cancel_on_indexing_stop: Option<bool>,
}

#[napi(object)]
pub struct OcrDiagnostics {
    pub loaded: bool,
    pub accelerated: bool,
    pub provider: String,
    pub acceleration_error: Option<String>,
}

#[napi]
pub fn ocr_diagnostics(cache_dir: String, provider: String) -> OcrDiagnostics {
    let store = AssetStore::new(PathBuf::from(&cache_dir));
    match engine(&store, Preference::parse(&provider)) {
        Ok(engine) => OcrDiagnostics {
            loaded: true,
            accelerated: engine.accelerated,
            provider: engine.provider.to_string(),
            acceleration_error: engine.acceleration_error.clone(),
        },
        Err(error) => OcrDiagnostics {
            loaded: false,
            accelerated: false,
            provider: "none".to_string(),
            acceleration_error: Some(error),
        },
    }
}

#[napi(object)]
pub struct AssetStatus {
    pub key: String,
    pub present: bool,
    pub size_bytes: Option<i64>,
    pub source_url: String,
    pub path: String,
}

static EMBEDDERS: OnceLock<Mutex<HashMap<Preference, Arc<Mutex<Embedder>>>>> = OnceLock::new();
static RERANKERS: OnceLock<Mutex<HashMap<Preference, Arc<Mutex<Reranker>>>>> = OnceLock::new();
static INDEXING_STOPPED: AtomicBool = AtomicBool::new(false);

#[napi(object)]
pub struct VectorChunkInput {
    pub id: String,
    pub document_id: String,
    pub chunk_index: f64,
    pub text: String,
    pub vector: Vec<f64>,
    pub file_name: String,
    pub page_number: f64,
    pub heading_path: String,
}

#[napi(object)]
pub struct VectorSearchResult {
    pub document_id: String,
    pub file_name: String,
    pub chunk_index: f64,
    pub text: String,
    pub page_number: f64,
    pub heading_path: String,
    pub score: f64,
}

fn ensure_indexing_running() -> Result<()> {
    if INDEXING_STOPPED.load(Ordering::Acquire) {
        Err(Error::from_reason("INDEXING_PAUSED"))
    } else {
        Ok(())
    }
}

#[napi]
pub fn stop_indexing() {
    INDEXING_STOPPED.store(true, Ordering::Release);
}

#[napi]
pub fn resume_indexing() {
    INDEXING_STOPPED.store(false, Ordering::Release);
}

#[napi]
pub fn initialize_vector_index(directory: String) -> Result<bool> {
    vector_index::initialize(&directory).map_err(Error::from_reason)
}

#[napi]
pub fn complete_vector_index_initialization(directory: String) -> Result<()> {
    vector_index::complete_initialization(&directory).map_err(Error::from_reason)
}

pub struct AppendVectorChunksTask {
    directory: String,
    store_id: String,
    rows: Vec<VectorChunkInput>,
}

#[napi]
pub fn append_vector_chunks(
    directory: String,
    store_id: String,
    rows: Vec<VectorChunkInput>,
) -> AsyncTask<AppendVectorChunksTask> {
    AsyncTask::new(AppendVectorChunksTask {
        directory,
        store_id,
        rows,
    })
}

impl Task for AppendVectorChunksTask {
    type Output = ();
    type JsValue = ();
    fn compute(&mut self) -> Result<Self::Output> {
        ensure_indexing_running()?;
        let rows = std::mem::take(&mut self.rows)
            .into_iter()
            .map(|row| vector_index::ChunkRow {
                id: row.id,
                document_id: row.document_id,
                chunk_index: row.chunk_index,
                text: row.text,
                vector: row.vector.into_iter().map(|value| value as f32).collect(),
                file_name: row.file_name,
                page_number: row.page_number,
                heading_path: row.heading_path,
            })
            .collect();
        vector_index::append(&self.directory, &self.store_id, rows).map_err(Error::from_reason)?;
        ensure_indexing_running()
    }
    fn resolve(&mut self, _: Env, _: Self::Output) -> Result<Self::JsValue> {
        Ok(())
    }
}

pub struct FinalizeVectorIndexTask {
    directory: String,
    store_id: String,
    hybrid: bool,
}

#[napi]
pub fn finalize_vector_index(
    directory: String,
    store_id: String,
    hybrid: bool,
) -> AsyncTask<FinalizeVectorIndexTask> {
    AsyncTask::new(FinalizeVectorIndexTask {
        directory,
        store_id,
        hybrid,
    })
}

impl Task for FinalizeVectorIndexTask {
    type Output = ();
    type JsValue = ();
    fn compute(&mut self) -> Result<()> {
        ensure_indexing_running()?;
        vector_index::finalize(&self.directory, &self.store_id, self.hybrid)
            .map_err(Error::from_reason)
    }
    fn resolve(&mut self, _: Env, _: ()) -> Result<()> {
        Ok(())
    }
}

pub struct RemoveVectorDocumentTask {
    directory: String,
    store_id: String,
    document_id: String,
}

#[napi]
pub fn remove_vector_document(
    directory: String,
    store_id: String,
    document_id: String,
) -> AsyncTask<RemoveVectorDocumentTask> {
    AsyncTask::new(RemoveVectorDocumentTask {
        directory,
        store_id,
        document_id,
    })
}

impl Task for RemoveVectorDocumentTask {
    type Output = ();
    type JsValue = ();
    fn compute(&mut self) -> Result<()> {
        vector_index::remove_document(&self.directory, &self.store_id, &self.document_id)
            .map_err(Error::from_reason)
    }
    fn resolve(&mut self, _: Env, _: ()) -> Result<()> {
        Ok(())
    }
}

pub struct DropVectorStoreTask {
    directory: String,
    store_id: String,
}

#[napi]
pub fn drop_vector_store(directory: String, store_id: String) -> AsyncTask<DropVectorStoreTask> {
    AsyncTask::new(DropVectorStoreTask {
        directory,
        store_id,
    })
}

impl Task for DropVectorStoreTask {
    type Output = ();
    type JsValue = ();
    fn compute(&mut self) -> Result<()> {
        vector_index::drop_store(&self.directory, &self.store_id).map_err(Error::from_reason)
    }
    fn resolve(&mut self, _: Env, _: ()) -> Result<()> {
        Ok(())
    }
}

pub struct SearchVectorIndexTask {
    directory: String,
    store_id: String,
    query: String,
    vector: Vec<f64>,
    hybrid: bool,
    limit: u32,
}

#[napi]
pub fn search_vector_index(
    directory: String,
    store_id: String,
    query: String,
    vector: Vec<f64>,
    hybrid: bool,
    limit: u32,
) -> AsyncTask<SearchVectorIndexTask> {
    AsyncTask::new(SearchVectorIndexTask {
        directory,
        store_id,
        query,
        vector,
        hybrid,
        limit,
    })
}

impl Task for SearchVectorIndexTask {
    type Output = Vec<vector_index::SearchRow>;
    type JsValue = Vec<VectorSearchResult>;
    fn compute(&mut self) -> Result<Self::Output> {
        vector_index::search(
            &self.directory,
            &self.store_id,
            &self.query,
            self.vector.iter().map(|value| *value as f32).collect(),
            self.hybrid,
            self.limit.clamp(1, 100) as usize,
        )
        .map_err(Error::from_reason)
    }
    fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output
            .into_iter()
            .map(|row| VectorSearchResult {
                document_id: row.document_id,
                file_name: row.file_name,
                chunk_index: row.chunk_index,
                text: row.text,
                page_number: row.page_number,
                heading_path: row.heading_path,
                score: row.score,
            })
            .collect())
    }
}

pub struct EmbedTextsTask {
    cache_dir: String,
    provider: String,
    texts: Vec<String>,
}

#[napi]
pub fn embed_texts(
    cache_dir: String,
    provider: String,
    texts: Vec<String>,
) -> AsyncTask<EmbedTextsTask> {
    AsyncTask::new(EmbedTextsTask {
        cache_dir,
        provider,
        texts,
    })
}

impl Task for EmbedTextsTask {
    type Output = Vec<Vec<f64>>;
    type JsValue = Vec<Vec<f64>>;
    fn compute(&mut self) -> Result<Self::Output> {
        let store = AssetStore::new(PathBuf::from(&self.cache_dir));
        let preference = Preference::parse(&self.provider);
        let embedder = embedder(&store, preference).map_err(Error::from_reason)?;
        let mut guard = embedder
            .lock()
            .map_err(|_| Error::from_reason("Модель векторизации занята"))?;
        let vectors = guard.embed(&self.texts).map_err(Error::from_reason)?;
        Ok(vectors
            .into_iter()
            .map(|vector| vector.into_iter().map(f64::from).collect())
            .collect())
    }
    fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi(object)]
pub struct RerankResult {
    pub scores: Vec<f64>,
    pub provider: String,
    pub acceleration_error: Option<String>,
}

pub struct RerankTask {
    cache_dir: String,
    provider: String,
    query: String,
    passages: Vec<String>,
}

#[napi]
pub fn rerank_passages(
    cache_dir: String,
    provider: String,
    query: String,
    passages: Vec<String>,
) -> AsyncTask<RerankTask> {
    AsyncTask::new(RerankTask {
        cache_dir,
        provider,
        query,
        passages,
    })
}

#[napi]
pub fn rerank_available(cache_dir: String) -> bool {
    let store = AssetStore::new(PathBuf::from(&cache_dir));
    crate::assets::RERANK_ASSETS
        .iter()
        .all(|spec| store.resolved_path(spec).is_file())
}

impl Task for RerankTask {
    type Output = RerankResult;
    type JsValue = RerankResult;
    fn compute(&mut self) -> Result<Self::Output> {
        let store = AssetStore::new(PathBuf::from(&self.cache_dir));
        let preference = Preference::parse(&self.provider);
        let reranker = reranker(&store, preference).map_err(Error::from_reason)?;
        let mut guard = reranker
            .lock()
            .map_err(|_| Error::from_reason("Модель переоценки занята"))?;
        let scores = guard
            .score(&self.query, &self.passages)
            .map_err(Error::from_reason)?;
        Ok(RerankResult {
            scores: scores.into_iter().map(f64::from).collect(),
            provider: guard.provider.to_string(),
            acceleration_error: guard.acceleration_error.clone(),
        })
    }
    fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

fn reranker(
    store: &AssetStore,
    preference: Preference,
) -> std::result::Result<Arc<Mutex<Reranker>>, String> {
    let cache = RERANKERS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache
        .lock()
        .map_err(|_| "Кэш моделей переоценки повреждён".to_string())?;
    if let Some(existing) = guard.get(&preference) {
        return Ok(existing.clone());
    }
    let loaded = Arc::new(Mutex::new(Reranker::load(store, preference)?));
    guard.insert(preference, loaded.clone());
    Ok(loaded)
}

fn embedder(
    store: &AssetStore,
    preference: Preference,
) -> std::result::Result<Arc<Mutex<Embedder>>, String> {
    let cache = EMBEDDERS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache
        .lock()
        .map_err(|_| "Кэш моделей векторизации повреждён".to_string())?;
    if let Some(existing) = guard.get(&preference) {
        return Ok(existing.clone());
    }
    let loaded = Arc::new(Mutex::new(Embedder::load(store, preference)?));
    guard.insert(preference, loaded.clone());
    Ok(loaded)
}

#[napi(object)]
pub struct DownloadGroupStatus {
    pub id: String,
    pub installed: bool,
    pub download_bytes: i64,
    pub size_bytes: i64,
    pub directory: String,
    pub components: Vec<AssetStatus>,
}

#[napi]
pub fn download_status(cache_dir: String) -> Vec<DownloadGroupStatus> {
    let store = AssetStore::new(PathBuf::from(&cache_dir));
    downloads::GROUPS
        .iter()
        .map(|entry| {
            let components: Vec<AssetStatus> = entry
                .specs
                .iter()
                .map(|spec| AssetStatus {
                    key: spec.key.to_string(),
                    present: store.is_present(spec),
                    size_bytes: Some(store.size_on_disk(spec) as i64),
                    source_url: spec.url.to_string(),
                    path: store.resolved_path(spec).to_string_lossy().into_owned(),
                })
                .collect();
            DownloadGroupStatus {
                id: entry.id.to_string(),
                installed: components.iter().all(|component| component.present),
                download_bytes: entry.download_bytes,
                size_bytes: components
                    .iter()
                    .map(|component| component.size_bytes.unwrap_or(0))
                    .sum(),
                directory: downloads::group_directory(&cache_dir, entry)
                    .to_string_lossy()
                    .into_owned(),
                components,
            }
        })
        .collect()
}

#[napi]
pub fn embedding_dimension() -> Option<u32> {
    let cache = EMBEDDERS.get()?;
    let guard = cache.lock().ok()?;
    let embedder = guard.values().next()?;
    let dimension = embedder.lock().ok()?.dimension;
    u32::try_from(dimension).ok()
}

#[napi]
pub fn cancel_download(id: String) {
    downloads::request_cancel(&id);
}

#[napi]
pub fn delete_download(cache_dir: String, id: String) -> Result<Vec<DownloadGroupStatus>> {
    let entry = downloads::group(&id)
        .ok_or_else(|| Error::from_reason(format!("Неизвестная загрузка «{id}»")))?;
    let store = AssetStore::new(PathBuf::from(&cache_dir));
    clear_caches()?;
    for spec in entry.specs.iter() {
        store.remove(spec).map_err(Error::from_reason)?;
    }
    Ok(download_status(cache_dir))
}

fn clear_caches() -> Result<()> {
    ENGINES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| Error::from_reason("Кэш OCR-движков повреждён"))?
        .clear();
    EMBEDDERS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| Error::from_reason("Кэш моделей повреждён"))?
        .clear();
    Ok(())
}

pub struct StartDownloadTask {
    cache_dir: String,
    id: String,
    on_progress: Option<ProgressCallback>,
}

#[napi]
pub fn start_download(
    cache_dir: String,
    id: String,
    on_progress: Option<ProgressCallback>,
) -> AsyncTask<StartDownloadTask> {
    downloads::clear_cancel(&id);
    AsyncTask::new(StartDownloadTask {
        cache_dir,
        id,
        on_progress,
    })
}

impl Task for StartDownloadTask {
    type Output = ();
    type JsValue = ();
    fn compute(&mut self) -> Result<Self::Output> {
        let entry = downloads::group(&self.id)
            .ok_or_else(|| Error::from_reason(format!("Неизвестная загрузка «{}»", self.id)))?;
        let store = AssetStore::new(PathBuf::from(&self.cache_dir));
        let callback = self.on_progress.take();
        let mut reporter = Reporter::new(callback);
        let id = self.id.clone();
        let outcome = entry.specs.iter().try_for_each(|spec| {
            store
                .ensure_cancellable(spec, &mut |progress| reporter.report(progress), &|| {
                    downloads::is_cancelled(&id)
                })
                .map(|_| ())
        });
        downloads::clear_cancel(&self.id);
        if outcome.is_ok() {
            clear_caches()?;
        }
        outcome.map_err(Error::from_reason)
    }
    fn resolve(&mut self, _: Env, _: Self::Output) -> Result<Self::JsValue> {
        Ok(())
    }
}

pub struct ExtractDocumentTask(ExtractDocumentRequest);

#[napi]
pub fn extract_document(request: ExtractDocumentRequest) -> AsyncTask<ExtractDocumentTask> {
    AsyncTask::new(ExtractDocumentTask(request))
}

impl Task for ExtractDocumentTask {
    type Output = ExtractDocumentResult;
    type JsValue = ExtractDocumentResult;
    fn compute(&mut self) -> Result<Self::Output> {
        extract(&self.0)
    }
    fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

const PROGRESS_STEP_PERCENT: f64 = 0.5;
const PROGRESS_INTERVAL_MS: u128 = 200;

struct Reporter {
    callback: Option<ProgressCallback>,
    last_percent: f64,
    last_emitted: std::time::Instant,
    last_key: String,
}

impl Reporter {
    fn new(callback: Option<ProgressCallback>) -> Self {
        Self {
            callback,
            last_percent: -1.0,
            last_emitted: std::time::Instant::now(),
            last_key: String::new(),
        }
    }

    fn report(&mut self, progress: AssetProgress) {
        let Some(callback) = self.callback.as_ref() else {
            return;
        };
        let percent = progress
            .total
            .filter(|total| *total > 0)
            .map(|total| progress.downloaded as f64 * 100.0 / total as f64);
        let terminal = progress.stage != AssetStage::Downloading;
        let switched = self.last_key != progress.key;
        let stepped = percent
            .map(|value| value - self.last_percent >= PROGRESS_STEP_PERCENT)
            .unwrap_or(true);
        let elapsed = self.last_emitted.elapsed().as_millis() >= PROGRESS_INTERVAL_MS;
        if !terminal && !switched && !(stepped && elapsed) {
            return;
        }
        self.last_percent = percent.unwrap_or(-1.0);
        self.last_emitted = std::time::Instant::now();
        self.last_key = progress.key.to_string();
        callback.call(
            AssetProgressEvent {
                key: progress.key.to_string(),
                stage: match progress.stage {
                    AssetStage::Downloading => "downloading",
                    AssetStage::Unpacking => "unpacking",
                    AssetStage::Ready => "ready",
                }
                .to_string(),
                downloaded: progress.downloaded as f64,
                total: progress.total.map(|value| value as f64),
                percent,
            },
            ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

static ENGINES: OnceLock<Mutex<HashMap<Preference, Arc<OcrEngine>>>> = OnceLock::new();

fn engine(
    store: &AssetStore,
    preference: Preference,
) -> std::result::Result<Arc<OcrEngine>, String> {
    let cache = ENGINES.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache
        .lock()
        .map_err(|_| "Кэш OCR-движков повреждён".to_string())?;
    if let Some(existing) = guard.get(&preference) {
        return Ok(existing.clone());
    }
    let loaded = Arc::new(OcrEngine::load(store, preference)?);
    guard.insert(preference, loaded.clone());
    Ok(loaded)
}

fn flat_document(extension: &str, bytes: &[u8]) -> Result<ExtractDocumentResult> {
    let text = match extension {
        "docx" => extract_docx(bytes).map_err(Error::from_reason)?,
        "txt" | "md" | "csv" | "log" => extract_plain(bytes),
        other => {
            return Err(Error::from_reason(format!(
                "Формат «{other}» не поддерживается"
            )));
        }
    };
    let text = text.trim().to_string();
    let empty = text.is_empty();
    let characters = u32::try_from(text.chars().count()).unwrap_or(u32::MAX);
    Ok(ExtractDocumentResult {
        pages: vec![ExtractedPageResult {
            page_number: 0,
            text,
            route: if empty { "empty" } else { "text-layer" }.to_string(),
            recognised_lines: 0,
        }],
        text_layer_pages: u32::from(!empty),
        ocr_pages: 0,
        empty_pages: u32::from(empty),
        characters,
        accelerated: false,
        acceleration_error: None,
    })
}

fn extract(request: &ExtractDocumentRequest) -> Result<ExtractDocumentResult> {
    if request.cancel_on_indexing_stop.unwrap_or(false) {
        ensure_indexing_running()?;
    }
    let path = PathBuf::from(&request.file_path);
    let metadata = std::fs::metadata(&path)
        .map_err(|error| Error::from_reason(format!("Документ недоступен: {error}")))?;
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err(Error::from_reason("Документ превышает допустимый размер"));
    }
    let bytes = std::fs::read(&path)
        .map_err(|error| Error::from_reason(format!("Не удалось прочитать документ: {error}")))?;

    let extension = path
        .extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if extension != "pdf" {
        return flat_document(&extension, &bytes);
    }

    let store = AssetStore::new(PathBuf::from(&request.cache_dir));
    let library = store
        .ensure(&PDFIUM, &mut |_| {})
        .map_err(Error::from_reason)?;
    let worker = worker(&library).map_err(Error::from_reason)?;
    let recognise = request.recognise_scans.unwrap_or(true);
    let ocr = if recognise {
        Some(
            engine(
                &store,
                Preference::parse(request.provider.as_deref().unwrap_or("auto")),
            )
            .map_err(Error::from_reason)?,
        )
    } else {
        None
    };
    let render_width = request
        .render_width
        .map(|value| value.clamp(600, 4096) as i32)
        .unwrap_or(DEFAULT_RENDER_WIDTH);
    let incoming = worker
        .extract(ExtractRequest {
            bytes,
            render_width,
            render_for_ocr: recognise,
        })
        .map_err(Error::from_reason)?;

    let mut pages = Vec::new();
    let mut text_layer_pages = 0;
    let mut ocr_pages = 0;
    let mut empty_pages = 0;
    let mut characters = 0_usize;
    for page in incoming {
        if request.cancel_on_indexing_stop.unwrap_or(false) {
            ensure_indexing_running()?;
        }
        let page = page.map_err(Error::from_reason)?;
        match page.route {
            PageRoute::TextLayer => text_layer_pages += 1,
            PageRoute::Ocr => ocr_pages += 1,
            PageRoute::Empty => empty_pages += 1,
        }
        let mut text = match page.route {
            PageRoute::TextLayer => page.text,
            PageRoute::Ocr | PageRoute::Empty => String::new(),
        };
        let mut recognised_lines = 0;
        if let (Some(engine), Some(image)) = (ocr.as_ref(), page.image.as_ref()) {
            let read = engine.read_page(image).map_err(Error::from_reason)?;
            recognised_lines = u32::try_from(read.lines).unwrap_or(u32::MAX);
            if !read.text.is_empty() {
                text = read.text;
            }
        }
        characters += text.chars().count();
        pages.push(ExtractedPageResult {
            page_number: u32::from(page.number),
            text,
            route: page.route.as_str().to_string(),
            recognised_lines,
        });
    }
    Ok(ExtractDocumentResult {
        pages,
        text_layer_pages,
        ocr_pages,
        empty_pages,
        characters: u32::try_from(characters).unwrap_or(u32::MAX),
        accelerated: ocr
            .as_ref()
            .map(|engine| engine.accelerated)
            .unwrap_or(false),
        acceleration_error: ocr.and_then(|engine| engine.acceleration_error.clone()),
    })
}
