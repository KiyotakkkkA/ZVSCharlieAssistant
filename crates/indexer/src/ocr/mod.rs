pub mod detect;
pub mod dict;
pub mod recognize;

use std::{path::Path, sync::Mutex};

use image::DynamicImage;
use ort::{
    ep::{CPU, CUDA, DirectML},
    session::{Session, builder::GraphOptimizationLevel},
    value::TensorRef,
};

use crate::assets::{AssetStore, OCR_DET, OCR_REC, OCR_REC_CONFIG};

const RECOGNITION_BATCH: usize = 8;
const MIN_CONFIDENCE: f32 = 0.35;

pub struct OcrEngine {
    detection: Mutex<Session>,
    recognition: Mutex<Session>,
    charset: Vec<String>,
    pub accelerated: bool,
    pub provider: &'static str,
    pub acceleration_error: Option<String>,
}

pub struct PageText {
    pub text: String,
    pub lines: usize,
    pub rejected_lines: usize,
    pub mean_confidence: f32,
    pub timing: PageTiming,
}

#[derive(Default, Clone, Copy)]
pub struct PageTiming {
    pub detect_prepare_ms: u128,
    pub detect_infer_ms: u128,
    pub detect_decode_ms: u128,
    pub recognise_prepare_ms: u128,
    pub recognise_infer_ms: u128,
    pub recognise_decode_ms: u128,
}

fn mean_confidence(total: f32, accepted: usize) -> f32 {
    if accepted == 0 {
        return 0.0;
    }
    total / accepted as f32
}

impl OcrEngine {
    pub fn load(store: &AssetStore, preference: Preference) -> Result<Self, String> {
        let detection_path = store.ensure(&OCR_DET, &mut |_| {})?;
        let recognition_path = store.ensure(&OCR_REC, &mut |_| {})?;
        let config_path = store.ensure(&OCR_REC_CONFIG, &mut |_| {})?;
        let config = std::fs::read_to_string(&config_path)
            .map_err(|error| format!("Не удалось прочитать конфигурацию модели: {error}"))?;
        let charset = dict::parse_charset(&config)?;

        if preference != Preference::Cpu {
            register_cuda_libraries(store);
        }
        let detection = build_session(&detection_path, preference, [1, 3, 64, 64])?;
        let recognition = build_session(&recognition_path, preference, [1, 3, 48, 320])?;
        let provider = if detection.provider == recognition.provider {
            detection.provider
        } else {
            "cpu"
        };
        Ok(Self {
            detection: Mutex::new(detection.session),
            recognition: Mutex::new(recognition.session),
            charset,
            accelerated: provider != "cpu",
            provider,
            acceleration_error: detection
                .error
                .or(recognition.error)
                .filter(|_| provider == "cpu"),
        })
    }

    pub fn read_page(&self, image: &DynamicImage) -> Result<PageText, String> {
        let mut timing = PageTiming::default();
        let boxes = self.detect(image, &mut timing)?;
        if boxes.is_empty() {
            return Ok(PageText {
                text: String::new(),
                lines: 0,
                rejected_lines: 0,
                mean_confidence: 0.0,
                timing,
            });
        }
        let crops: Vec<DynamicImage> = boxes
            .iter()
            .map(|area| recognize::crop(image, area))
            .collect();

        let mut lines = Vec::new();
        let mut rejected_lines = 0_usize;
        let mut confidence_total = 0.0_f32;
        for chunk in crops.chunks(RECOGNITION_BATCH) {
            for decoded in self.recognize(chunk, &mut timing)? {
                let trimmed = decoded.text.trim().to_string();
                if trimmed.is_empty() {
                    continue;
                }
                if decoded.confidence < MIN_CONFIDENCE {
                    rejected_lines += 1;
                    continue;
                }
                confidence_total += decoded.confidence;
                lines.push(trimmed);
            }
        }
        Ok(PageText {
            text: lines.join("\n"),
            mean_confidence: mean_confidence(confidence_total, lines.len()),
            lines: lines.len(),
            rejected_lines,
            timing,
        })
    }

    fn detect(
        &self,
        image: &DynamicImage,
        timing: &mut PageTiming,
    ) -> Result<Vec<detect::TextBox>, String> {
        let clock = std::time::Instant::now();
        let input = detect::prepare(image);
        timing.detect_prepare_ms += clock.elapsed().as_millis();
        let mut session = self
            .detection
            .lock()
            .map_err(|_| "Сессия детекции повреждена".to_string())?;
        let name = session.inputs()[0].name().to_string();
        let tensor = TensorRef::from_array_view(&input.tensor)
            .map_err(|error| format!("Не удалось подготовить тензор детекции: {error}"))?;
        let clock = std::time::Instant::now();
        let outputs = session
            .run(ort::inputs![name.as_str() => tensor])
            .map_err(|error| format!("Детекция текста не удалась: {error}"))?;
        timing.detect_infer_ms += clock.elapsed().as_millis();
        let (shape, values) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|error| format!("Некорректный вывод детекции: {error}"))?;
        let dimensions: Vec<usize> = shape.iter().map(|value| *value as usize).collect();
        let map_height = dimensions[dimensions.len() - 2];
        let map_width = dimensions[dimensions.len() - 1];
        let clock = std::time::Instant::now();
        let boxes = detect::decode(
            values,
            map_width,
            map_height,
            &input,
            image.width(),
            image.height(),
        );
        timing.detect_decode_ms += clock.elapsed().as_millis();
        Ok(boxes)
    }

    fn recognize(
        &self,
        crops: &[DynamicImage],
        timing: &mut PageTiming,
    ) -> Result<Vec<recognize::Decoded>, String> {
        let clock = std::time::Instant::now();
        let width = recognize::batch_width(crops);
        let batch = recognize::prepare(crops, width);
        timing.recognise_prepare_ms += clock.elapsed().as_millis();
        let mut session = self
            .recognition
            .lock()
            .map_err(|_| "Сессия распознавания повреждена".to_string())?;
        let name = session.inputs()[0].name().to_string();
        let tensor = TensorRef::from_array_view(&batch.tensor)
            .map_err(|error| format!("Не удалось подготовить тензор распознавания: {error}"))?;
        let clock = std::time::Instant::now();
        let outputs = session
            .run(ort::inputs![name.as_str() => tensor])
            .map_err(|error| format!("Распознавание текста не удалось: {error}"))?;
        timing.recognise_infer_ms += clock.elapsed().as_millis();
        let (shape, values) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|error| format!("Некорректный вывод распознавания: {error}"))?;
        let dimensions: Vec<usize> = shape.iter().map(|value| *value as usize).collect();
        let timesteps = dimensions[1];
        let classes = dimensions[2];
        let stride = timesteps * classes;
        let clock = std::time::Instant::now();
        let decoded: Vec<recognize::Decoded> = (0..batch.count)
            .map(|index| {
                recognize::ctc_decode(
                    &values[index * stride..(index + 1) * stride],
                    timesteps,
                    classes,
                    &self.charset,
                )
            })
            .collect();
        timing.recognise_decode_ms += clock.elapsed().as_millis();
        Ok(decoded)
    }
}

pub struct LoadedSession {
    pub session: Session,
    pub provider: &'static str,
    pub error: Option<String>,
}

pub fn build_embedding_session(
    path: &Path,
    preference: Preference,
) -> Result<LoadedSession, String> {
    let mut first_error: Option<String> = None;
    let skip_cuda = !crate::device::cuda_kernels_supported();
    for (accelerator, name) in preference.chain(!skip_cuda) {
        match commit(path, *accelerator).and_then(warm_embedding) {
            Ok(session) => {
                return Ok(LoadedSession {
                    session,
                    provider: name,
                    error: first_error,
                });
            }
            Err(error) => {
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
    }
    Ok(LoadedSession {
        session: commit(path, Accelerator::Cpu)?,
        provider: "cpu",
        error: first_error,
    })
}

pub(crate) fn register_cuda_libraries(store: &AssetStore) {
    static REGISTERED: std::sync::OnceLock<()> = std::sync::OnceLock::new();
    if REGISTERED.get().is_some() {
        return;
    }
    let directories: Vec<String> = crate::assets::CUDA_ASSETS
        .iter()
        .map(|spec| store.directory(spec))
        .filter(|directory| directory.is_dir())
        .map(|directory| directory.to_string_lossy().into_owned())
        .collect();
    if directories.is_empty() {
        return;
    }
    let current = std::env::var("PATH").unwrap_or_default();
    let joined = format!("{};{current}", directories.join(";"));
    unsafe { std::env::set_var("PATH", joined) };
    let _ = REGISTERED.set(());
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Preference {
    Auto,
    Cuda,
    DirectMl,
    Cpu,
}

impl Preference {
    pub fn parse(value: &str) -> Self {
        match value {
            "cuda" => Self::Cuda,
            "directml" => Self::DirectMl,
            "cpu" => Self::Cpu,
            _ => Self::Auto,
        }
    }

    fn chain(self, cuda_supported: bool) -> &'static [(Accelerator, &'static str)] {
        match self {
            Self::Auto if cuda_supported => &[
                (Accelerator::Cuda, "cuda"),
                (Accelerator::DirectMl, "directml"),
            ],
            Self::Auto => &[(Accelerator::DirectMl, "directml")],
            Self::Cuda if cuda_supported => &[(Accelerator::Cuda, "cuda")],
            Self::Cuda => &[(Accelerator::DirectMl, "directml")],
            Self::DirectMl => &[(Accelerator::DirectMl, "directml")],
            Self::Cpu => &[],
        }
    }
}

fn build_session(
    path: &Path,
    preference: Preference,
    warmup: [usize; 4],
) -> Result<LoadedSession, String> {
    let mut first_error: Option<String> = None;
    let skip_cuda = !crate::device::cuda_kernels_supported();
    for (accelerator, name) in preference.chain(!skip_cuda) {
        match commit(path, *accelerator).and_then(|session| warm(session, warmup)) {
            Ok(session) => {
                return Ok(LoadedSession {
                    session,
                    provider: name,
                    error: first_error,
                });
            }
            Err(error) => {
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
    }
    Ok(LoadedSession {
        session: commit(path, Accelerator::Cpu)?,
        provider: "cpu",
        error: first_error,
    })
}

fn warm(mut session: Session, shape: [usize; 4]) -> Result<Session, String> {
    let tensor = ndarray::Array4::<f32>::zeros(shape);
    let name = session.inputs()[0].name().to_string();
    let value = TensorRef::from_array_view(&tensor)
        .map_err(|error| format!("Проверочный тензор не создан: {error}"))?;
    session
        .run(ort::inputs![name.as_str() => value])
        .map_err(|error| format!("Проверочный запуск не удался: {error}"))?;
    Ok(session)
}

fn warm_embedding(mut session: Session) -> Result<Session, String> {
    let input_ids = ndarray::Array2::<i64>::zeros((1, 8));
    let attention_mask = ndarray::Array2::<i64>::ones((1, 8));
    let input_ids = TensorRef::from_array_view(&input_ids)
        .map_err(|error| format!("Проверочный input_ids не создан: {error}"))?;
    let attention_mask = TensorRef::from_array_view(&attention_mask)
        .map_err(|error| format!("Проверочный attention_mask не создан: {error}"))?;
    session
        .run(ort::inputs![
            "input_ids" => input_ids,
            "attention_mask" => attention_mask,
        ])
        .map_err(|error| format!("Проверочный запуск embedding-модели не удался: {error}"))?;
    Ok(session)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Accelerator {
    Cuda,
    DirectMl,
    Cpu,
}

fn commit(path: &Path, accelerator: Accelerator) -> Result<Session, String> {
    let builder = Session::builder().map_err(|error| format!("{error}"))?;
    let builder = match accelerator {
        Accelerator::Cuda => builder
            .with_execution_providers([CUDA::default().build().error_on_failure()])
            .map_err(|error| format!("{error}"))?,
        Accelerator::DirectMl => builder
            .with_execution_providers([DirectML::default().build().error_on_failure()])
            .map_err(|error| format!("{error}"))?,
        Accelerator::Cpu => builder
            .with_execution_providers([CPU::default().build()])
            .map_err(|error| format!("{error}"))?,
    };
    builder
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|error| format!("{error}"))?
        .commit_from_file(path)
        .map_err(|error| format!("Не удалось загрузить модель: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn averages_confidence_over_accepted_lines_only() {
        assert!((mean_confidence(2.4, 3) - 0.8).abs() < 1e-6);
    }

    #[test]
    fn reports_zero_confidence_when_nothing_was_accepted() {
        assert_eq!(mean_confidence(0.0, 0), 0.0);
    }

    use crate::{
        assets::PDFIUM,
        extract::{
            pdf::{ExtractRequest, worker},
            route::PageRoute,
        },
    };

    #[test]
    fn uses_directml_when_cuda_kernels_do_not_support_the_gpu() {
        assert!(matches!(
            Preference::Auto.chain(false),
            [(Accelerator::DirectMl, "directml")]
        ));
        assert!(matches!(
            Preference::Cuda.chain(false),
            [(Accelerator::DirectMl, "directml")]
        ));
    }

    #[test]
    #[ignore = "требует ZVS_PDF_FIXTURE и модели"]
    fn reads_scanned_pages_of_a_real_document() {
        let fixture = std::env::var("ZVS_PDF_FIXTURE").expect("укажите ZVS_PDF_FIXTURE");
        let store = AssetStore::new(std::env::temp_dir().join("zvs-asset-probe"));
        let library = store.ensure(&PDFIUM, &mut |_| {}).expect("pdfium доступен");
        let use_cuda = std::env::var("ZVS_OCR_CUDA").is_ok();
        let preference = if use_cuda { Preference::Auto } else { Preference::Cpu };
        let started = std::time::Instant::now();
        let engine = OcrEngine::load(&store, preference).expect("движок загружается");
        println!(
            "движок готов за {:?}, ускорение={}",
            started.elapsed(),
            engine.accelerated
        );

        let bytes = std::fs::read(&fixture).expect("файл читается");
        let pages = worker(&library)
            .expect("поток pdfium")
            .extract(ExtractRequest {
                bytes,
                render_width: 1654,
                render_for_ocr: true,
            })
            .expect("извлечение стартует");

        let mut recognised = 0;
        for page in pages {
            let page = page.expect("страница");
            if page.route != PageRoute::Ocr {
                continue;
            }
            let Some(image) = page.image else { continue };
            let clock = std::time::Instant::now();
            let result = engine.read_page(&image).expect("распознавание");
            let t = result.timing;
            println!(
                "стр.{}: строк={} за {:?} | det: prep={} infer={} decode={} | rec: prep={} infer={} decode={}",
                page.number,
                result.lines,
                clock.elapsed(),
                t.detect_prepare_ms,
                t.detect_infer_ms,
                t.detect_decode_ms,
                t.recognise_prepare_ms,
                t.recognise_infer_ms,
                t.recognise_decode_ms,
            );
            let preview: String = result.text.chars().take(90).collect();
            println!("   {}", preview.replace('\n', " | "));
            if result.lines > 0 {
                recognised += 1;
            }
        }
        assert!(recognised > 0, "ни одна страница не распознана");
    }
}
