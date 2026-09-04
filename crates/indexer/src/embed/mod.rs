use std::path::Path;

use ndarray::Array2;
use ort::session::Session;
use ort::value::TensorRef;
use tokenizers::Tokenizer;

use crate::assets::{AssetStore, EMBED_MODEL, EMBED_TOKENIZER};
use crate::ocr::{Preference, build_embedding_session};

pub mod index;

pub const MAX_TOKENS: usize = 512;
pub const BATCH_TOKEN_BUDGET: usize = 8192;

pub struct Embedder {
    session: Session,
    tokenizer: Tokenizer,
    pub dimension: usize,
    pub provider: &'static str,
}

impl Embedder {
    pub fn load(store: &AssetStore, preference: Preference) -> Result<Self, String> {
        let model_path = store.ensure(&EMBED_MODEL, &mut |_| {})?;
        let tokenizer_path = store.ensure(&EMBED_TOKENIZER, &mut |_| {})?;
        let tokenizer = load_tokenizer(&tokenizer_path)?;
        if preference != Preference::Cpu {
            crate::ocr::register_cuda_libraries(store);
        }
        let loaded = build_embedding_session(&model_path, preference)?;
        let mut embedder = Self {
            session: loaded.session,
            tokenizer,
            dimension: 0,
            provider: loaded.provider,
        };
        embedder.dimension = embedder
            .embed(&["проверка".to_string()])?
            .first()
            .map(|vector| vector.len())
            .ok_or_else(|| "Модель не вернула вектор".to_string())?;
        Ok(embedder)
    }

    pub fn embed(&mut self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }
        let mut vectors = Vec::with_capacity(texts.len());
        for batch in plan_batches(&self.encode_all(texts)?) {
            vectors.extend(self.run_batch(&batch)?);
        }
        Ok(vectors)
    }

    fn encode_all(&self, texts: &[String]) -> Result<Vec<Vec<i64>>, String> {
        texts
            .iter()
            .map(|text| {
                let encoding = self
                    .tokenizer
                    .encode(text.as_str(), true)
                    .map_err(|error| format!("Не удалось разобрать текст: {error}"))?;
                let mut ids: Vec<i64> =
                    encoding.get_ids().iter().map(|id| i64::from(*id)).collect();
                ids.truncate(MAX_TOKENS);
                Ok(ids)
            })
            .collect()
    }

    fn run_batch(&mut self, batch: &[Vec<i64>]) -> Result<Vec<Vec<f32>>, String> {
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
            .map_err(|error| format!("Построение векторов не удалось: {error}"))?;
        let (shape, values) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|error| format!("Модель вернула неожиданный результат: {error}"))?;
        if shape.len() != 3 {
            return Err("Модель вернула тензор неожиданной формы".to_string());
        }
        let hidden = shape[2] as usize;
        Ok((0..rows)
            .map(|row| {
                let start = row * width * hidden;
                normalize(&values[start..start + hidden])
            })
            .collect())
    }
}

fn load_tokenizer(path: &Path) -> Result<Tokenizer, String> {
    Tokenizer::from_file(path)
        .map_err(|error| format!("Не удалось загрузить словарь модели: {error}"))
}

pub fn plan_batches(encoded: &[Vec<i64>]) -> Vec<Vec<Vec<i64>>> {
    let mut batches = Vec::new();
    let mut current: Vec<Vec<i64>> = Vec::new();
    let mut widest = 0_usize;
    for tokens in encoded {
        let next_widest = widest.max(tokens.len().max(1));
        if !current.is_empty() && next_widest * (current.len() + 1) > BATCH_TOKEN_BUDGET {
            batches.push(std::mem::take(&mut current));
            widest = tokens.len().max(1);
        } else {
            widest = next_widest;
        }
        current.push(tokens.clone());
    }
    if !current.is_empty() {
        batches.push(current);
    }
    batches
}

pub fn normalize(values: &[f32]) -> Vec<f32> {
    let length = values
        .iter()
        .map(|value| value * value)
        .sum::<f32>()
        .sqrt();
    if length <= f32::EPSILON {
        return values.to_vec();
    }
    values.iter().map(|value| value / length).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_to_unit_length() {
        let unit = normalize(&[3.0, 4.0]);
        assert!((unit[0] - 0.6).abs() < 1e-6);
        assert!((unit[1] - 0.8).abs() < 1e-6);
    }

    #[test]
    fn leaves_a_zero_vector_alone() {
        assert_eq!(normalize(&[0.0, 0.0]), vec![0.0, 0.0]);
    }

    #[test]
    fn keeps_every_text_when_splitting_batches() {
        let encoded: Vec<Vec<i64>> = (0..40).map(|index| vec![1_i64; index + 1]).collect();
        let batches = plan_batches(&encoded);
        assert_eq!(
            batches.iter().map(Vec::len).sum::<usize>(),
            encoded.len(),
            "ни один фрагмент не должен потеряться"
        );
    }

    #[test]
    fn keeps_padded_batches_within_the_token_budget() {
        let encoded: Vec<Vec<i64>> = (0..60).map(|_| vec![1_i64; 400]).collect();
        for batch in plan_batches(&encoded) {
            let widest = batch.iter().map(Vec::len).max().unwrap_or(0);
            assert!(widest * batch.len() <= BATCH_TOKEN_BUDGET);
        }
    }

    #[test]
    fn puts_a_single_oversized_text_in_its_own_batch() {
        let encoded = vec![vec![1_i64; MAX_TOKENS], vec![1_i64; 4]];
        let batches = plan_batches(&encoded);
        assert_eq!(batches.len(), 1);
    }
}
