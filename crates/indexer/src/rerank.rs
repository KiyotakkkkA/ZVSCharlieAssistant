use std::path::{Path, PathBuf};

use ndarray::Array2;
use ort::session::Session;
use ort::value::TensorRef;
use tokenizers::Tokenizer;

use crate::assets::{AssetSpec, AssetStore, RERANK_MODEL, RERANK_TOKENIZER};
use crate::ocr::{Preference, build_embedding_session};

pub const MAX_PAIR_TOKENS: usize = 512;
pub const RERANK_BATCH: usize = 8;

pub struct Reranker {
    session: Session,
    tokenizer: Tokenizer,
    pub provider: &'static str,
    pub acceleration_error: Option<String>,
}

impl Reranker {
    pub fn load(store: &AssetStore, preference: Preference) -> Result<Self, String> {
        let model_path = require_downloaded(store, &RERANK_MODEL)?;
        let tokenizer_path = require_downloaded(store, &RERANK_TOKENIZER)?;
        let tokenizer = load_tokenizer(&tokenizer_path)?;
        if preference != Preference::Cpu {
            crate::ocr::register_cuda_libraries(store);
        }
        let loaded = build_embedding_session(&model_path, preference)?;
        Ok(Self {
            session: loaded.session,
            tokenizer,
            provider: loaded.provider,
            acceleration_error: loaded.error,
        })
    }

    pub fn score(&mut self, query: &str, passages: &[String]) -> Result<Vec<f32>, String> {
        if passages.is_empty() {
            return Ok(Vec::new());
        }
        let encoded = self.encode_all(query, passages)?;
        let mut scores = Vec::with_capacity(passages.len());
        for batch in encoded.chunks(RERANK_BATCH) {
            scores.extend(self.run_batch(batch)?);
        }
        Ok(scores)
    }

    fn encode_all(&self, query: &str, passages: &[String]) -> Result<Vec<Vec<i64>>, String> {
        passages
            .iter()
            .map(|passage| {
                let encoding = self
                    .tokenizer
                    .encode((query, passage.as_str()), true)
                    .map_err(|error| format!("Не удалось разобрать текст: {error}"))?;
                let mut ids: Vec<i64> =
                    encoding.get_ids().iter().map(|id| i64::from(*id)).collect();
                ids.truncate(MAX_PAIR_TOKENS);
                Ok(ids)
            })
            .collect()
    }

    fn run_batch(&mut self, batch: &[Vec<i64>]) -> Result<Vec<f32>, String> {
        let rows = batch.len();
        let width = batch.iter().map(Vec::len).max().unwrap_or(1).max(1);
        let mut ids = Array2::<i64>::zeros((rows, width));
        let mut mask = Array2::<i64>::zeros((rows, width));
        for (row, tokens) in batch.iter().enumerate() {
            for (column, token) in tokens.iter().enumerate() {
                ids[[row, column]] = *token;
                mask[[row, column]] = 1;
            }
        }
        let id_tensor = TensorRef::from_array_view(&ids)
            .map_err(|error| format!("Не удалось подготовить входные данные: {error}"))?;
        let mask_tensor = TensorRef::from_array_view(&mask)
            .map_err(|error| format!("Не удалось подготовить маску: {error}"))?;
        let outputs = self
            .session
            .run(ort::inputs![
                "input_ids" => id_tensor,
                "attention_mask" => mask_tensor,
            ])
            .map_err(|error| format!("Переоценка фрагментов не удалась: {error}"))?;
        let (shape, values) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|error| format!("Модель вернула неожиданный результат: {error}"))?;
        let stride = logit_stride(&shape, rows)?;
        Ok((0..rows).map(|row| sigmoid(values[row * stride])).collect())
    }
}

fn logit_stride(shape: &[i64], rows: usize) -> Result<usize, String> {
    let total: i64 = shape.iter().product();
    if total <= 0 || rows == 0 || total % rows as i64 != 0 {
        return Err("Модель вернула тензор неожиданной формы".to_string());
    }
    Ok((total / rows as i64) as usize)
}

fn sigmoid(value: f32) -> f32 {
    1.0 / (1.0 + (-value).exp())
}

fn require_downloaded(store: &AssetStore, spec: &AssetSpec) -> Result<PathBuf, String> {
    let path = store.resolved_path(spec);
    if path.is_file() {
        return Ok(path);
    }
    Err(
        "Модель «Уточнение выдачи (bge-reranker-v2-m3)» не загружена. Откройте страницу «Загрузки» и нажмите «Загрузить»."
            .to_string(),
    )
}

fn load_tokenizer(path: &Path) -> Result<Tokenizer, String> {
    Tokenizer::from_file(path)
        .map_err(|error| format!("Не удалось загрузить словарь модели: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_a_logit_to_a_probability() {
        assert!((sigmoid(0.0) - 0.5).abs() < 1e-6);
        assert!(sigmoid(8.0) > 0.99);
        assert!(sigmoid(-8.0) < 0.01);
    }

    #[test]
    fn keeps_scores_ordered_by_logit() {
        assert!(sigmoid(2.0) > sigmoid(1.0));
        assert!(sigmoid(-1.0) < sigmoid(1.0));
    }

    #[test]
    fn reads_one_logit_per_row() {
        assert_eq!(logit_stride(&[4, 1], 4).unwrap(), 1);
        assert_eq!(logit_stride(&[2, 2], 2).unwrap(), 2);
    }

    #[test]
    fn rejects_a_tensor_that_does_not_cover_every_row() {
        assert!(logit_stride(&[3], 2).is_err());
        assert!(logit_stride(&[0], 2).is_err());
    }
}
