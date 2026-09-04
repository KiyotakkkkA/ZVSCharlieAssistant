use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};
use tar::Archive;

const DOWNLOAD_TIMEOUT_SECS: u64 = 600;
const MAX_ASSET_BYTES: u64 = 4 * 1024 * 1024 * 1024;

#[derive(Clone, Copy)]
pub enum Packaging {
    Raw,
    TarGz { member: &'static str },
    ZipLibraries { prefix: &'static str },
}

#[derive(Clone, Copy)]
pub struct AssetSpec {
    pub key: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub target: &'static str,
    pub packaging: Packaging,
}

pub const PDFIUM: AssetSpec = AssetSpec {
    key: "pdfium",
    url: "https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F7543/pdfium-win-x64.tgz",
    sha256: "0b08b606792a6cc593426efdefc6622611bce446d9e0270743846956ea1554ca",
    target: "pdfium.dll",
    packaging: Packaging::TarGz {
        member: "bin/pdfium.dll",
    },
};

pub const CUDA_RUNTIME: AssetSpec = AssetSpec {
    key: "cuda-runtime",
    url: "https://developer.download.nvidia.com/compute/cuda/redist/cuda_cudart/windows-x86_64/cuda_cudart-windows-x86_64-13.0.96-archive.zip",
    sha256: "a2ed875f9997aa24904fb70cc9db3acd9308433cde99bc8e63ec1271c9da31b4",
    target: "cudart64_13.dll",
    packaging: Packaging::ZipLibraries {
        prefix: "cuda_cudart-windows-x86_64-13.0.96-archive/bin/",
    },
};

pub const CUDA_CUBLAS: AssetSpec = AssetSpec {
    key: "cuda-cublas",
    url: "https://developer.download.nvidia.com/compute/cuda/redist/libcublas/windows-x86_64/libcublas-windows-x86_64-13.1.0.3-archive.zip",
    sha256: "4ac4847bbe4f7709b244956fcfc32197a2954ee70b155cb67eebd9ee26f7e339",
    target: "cublasLt64_13.dll",
    packaging: Packaging::ZipLibraries {
        prefix: "libcublas-windows-x86_64-13.1.0.3-archive/bin/",
    },
};

pub const CUDA_CUDNN: AssetSpec = AssetSpec {
    key: "cuda-cudnn",
    url: "https://files.pythonhosted.org/packages/fd/0f/d7e4141c1126899c7b8d202eb3085380164beefef32f94cc8967ed3a00ff/nvidia_cudnn_cu13-9.25.1.1-py3-none-win_amd64.whl",
    sha256: "e1de75bf1ad9040414f9b13cc87135d660d13dd3c859180dd6b63353e571f860",
    target: "cudnn64_9.dll",
    packaging: Packaging::ZipLibraries {
        prefix: "nvidia/cudnn/bin/",
    },
};

pub const EMBED_MODEL: AssetSpec = AssetSpec {
    key: "embed-model",
    url: "https://huggingface.co/Xenova/bge-m3/resolve/main/onnx/model_fp16.onnx",
    sha256: "4f1a646a3d4f39985589e9991a717044ede8278617fe55e3d246838bc05055e9",
    target: "bge-m3.onnx",
    packaging: Packaging::Raw,
};

pub const EMBED_TOKENIZER: AssetSpec = AssetSpec {
    key: "embed-tokenizer",
    url: "https://huggingface.co/Xenova/bge-m3/resolve/main/tokenizer.json",
    sha256: "6710678b12670bc442b99edc952c4d996ae309a7020c1fa0096dd245c2faf790",
    target: "tokenizer.json",
    packaging: Packaging::Raw,
};

pub const EMBED_ASSETS: [AssetSpec; 2] = [EMBED_MODEL, EMBED_TOKENIZER];

pub const CUDA_ASSETS: [AssetSpec; 3] = [CUDA_RUNTIME, CUDA_CUBLAS, CUDA_CUDNN];

pub const OCR_DET: AssetSpec = AssetSpec {
    key: "ocr-det",
    url: "https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx",
    sha256: "a431985659dc921974177a95adcfbb90fd9e51989a5e04d70d0b75f597b6e61d",
    target: "detection.onnx",
    packaging: Packaging::Raw,
};

pub const OCR_REC: AssetSpec = AssetSpec {
    key: "ocr-rec",
    url: "https://huggingface.co/PaddlePaddle/cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx",
    sha256: "5371ee1ddaa7983cc62d0818d99e982b6804638c85e4f960d59a574094e172e5",
    target: "recognition.onnx",
    packaging: Packaging::Raw,
};

pub const OCR_REC_CONFIG: AssetSpec = AssetSpec {
    key: "ocr-rec-config",
    url: "https://huggingface.co/PaddlePaddle/cyrillic_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.yml",
    sha256: "5c76cc91fa98410178a09f498db10050d0ec1634a660053d3005ab7be581f501",
    target: "recognition.yml",
    packaging: Packaging::Raw,
};

pub struct AssetStore {
    root: PathBuf,
}

impl AssetStore {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn resolved_path(&self, spec: &AssetSpec) -> PathBuf {
        self.root.join(spec.key).join(spec.target)
    }

    pub fn directory(&self, spec: &AssetSpec) -> PathBuf {
        self.root.join(spec.key)
    }

    pub fn is_present(&self, spec: &AssetSpec) -> bool {
        self.resolved_path(spec).is_file()
    }

    pub fn size_on_disk(&self, spec: &AssetSpec) -> u64 {
        let directory = self.directory(spec);
        let Ok(entries) = fs::read_dir(&directory) else {
            return 0;
        };
        entries
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| entry.metadata().ok())
            .filter(|meta| meta.is_file())
            .map(|meta| meta.len())
            .sum()
    }

    pub fn remove(&self, spec: &AssetSpec) -> Result<(), String> {
        let directory = self.directory(spec);
        if !directory.exists() {
            return Ok(());
        }
        fs::remove_dir_all(&directory).map_err(|error| {
            format!("Не удалось удалить файлы «{}»: {error}", spec.key)
        })
    }

    pub fn ensure(
        &self,
        spec: &AssetSpec,
        progress: &mut dyn FnMut(AssetProgress),
    ) -> Result<PathBuf, String> {
        self.ensure_cancellable(spec, progress, &|| false)
    }

    pub fn ensure_cancellable(
        &self,
        spec: &AssetSpec,
        progress: &mut dyn FnMut(AssetProgress),
        cancelled: &dyn Fn() -> bool,
    ) -> Result<PathBuf, String> {
        let target = self.resolved_path(spec);
        if target.is_file() {
            return Ok(target);
        }
        let directory = target
            .parent()
            .ok_or_else(|| format!("Некорректный путь ресурса «{}»", spec.key))?;
        fs::create_dir_all(directory)
            .map_err(|error| format!("Не удалось создать каталог ресурсов: {error}"))?;

        progress(AssetProgress {
            key: spec.key,
            downloaded: 0,
            total: None,
            stage: AssetStage::Downloading,
        });
        let payload = download(spec, progress, cancelled)?;

        if !spec.sha256.is_empty() {
            let actual = hex_digest(&payload);
            if !actual.eq_ignore_ascii_case(spec.sha256) {
                return Err(format!(
                    "Контрольная сумма ресурса «{}» не совпала: ожидалось {}, получено {actual}",
                    spec.key, spec.sha256
                ));
            }
        }

        progress(AssetProgress {
            key: spec.key,
            downloaded: payload.len() as u64,
            total: Some(payload.len() as u64),
            stage: AssetStage::Unpacking,
        });

        if let Packaging::ZipLibraries { prefix } = spec.packaging {
            let written = extract_libraries(&payload, prefix, directory).map_err(|error| {
                format!("Не удалось распаковать ресурс «{}»: {error}", spec.key)
            })?;
            progress(AssetProgress {
                key: spec.key,
                downloaded: written,
                total: Some(written),
                stage: AssetStage::Ready,
            });
            if !target.is_file() {
                return Err(format!(
                    "В архиве «{}» не оказалось файла {}",
                    spec.key, spec.target
                ));
            }
            return Ok(target);
        }

        let bytes = match spec.packaging {
            Packaging::Raw => payload,
            Packaging::TarGz { member } => extract_member(&payload, member).map_err(|error| {
                format!("Не удалось распаковать ресурс «{}»: {error}", spec.key)
            })?,
            Packaging::ZipLibraries { .. } => unreachable!(),
        };

        let staging = directory.join(format!("{}.partial", spec.target));
        fs::write(&staging, &bytes)
            .map_err(|error| format!("Не удалось записать ресурс «{}»: {error}", spec.key))?;
        fs::rename(&staging, &target)
            .map_err(|error| format!("Не удалось сохранить ресурс «{}»: {error}", spec.key))?;

        progress(AssetProgress {
            key: spec.key,
            downloaded: bytes.len() as u64,
            total: Some(bytes.len() as u64),
            stage: AssetStage::Ready,
        });
        Ok(target)
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AssetStage {
    Downloading,
    Unpacking,
    Ready,
}

pub struct AssetProgress {
    pub key: &'static str,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub stage: AssetStage,
}

pub const CANCELLED_MESSAGE: &str = "Загрузка отменена";

fn download(
    spec: &AssetSpec,
    progress: &mut dyn FnMut(AssetProgress),
    cancelled: &dyn Fn() -> bool,
) -> Result<Vec<u8>, String> {
    if cancelled() {
        return Err(CANCELLED_MESSAGE.to_string());
    }
    let agent = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(DOWNLOAD_TIMEOUT_SECS)))
        .build()
        .new_agent();
    let response = agent
        .get(spec.url)
        .call()
        .map_err(|error| format!("Не удалось загрузить «{}»: {error}", spec.key))?;
    let total = response
        .headers()
        .get("content-length")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());
    if let Some(size) = total
        && size > MAX_ASSET_BYTES
    {
        return Err(format!("Ресурс «{}» превышает допустимый размер", spec.key));
    }

    let mut reader = response.into_body().into_reader();
    let mut buffer = Vec::with_capacity(total.unwrap_or(8 * 1024 * 1024) as usize);
    let mut chunk = vec![0_u8; 256 * 1024];
    loop {
        let read = reader
            .read(&mut chunk)
            .map_err(|error| format!("Обрыв загрузки «{}»: {error}", spec.key))?;
        if read == 0 {
            break;
        }
        if cancelled() {
            return Err(CANCELLED_MESSAGE.to_string());
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.len() as u64 > MAX_ASSET_BYTES {
            return Err(format!("Ресурс «{}» превышает допустимый размер", spec.key));
        }
        progress(AssetProgress {
            key: spec.key,
            downloaded: buffer.len() as u64,
            total,
            stage: AssetStage::Downloading,
        });
    }
    Ok(buffer)
}

fn extract_member(payload: &[u8], member: &str) -> Result<Vec<u8>, String> {
    let mut archive = Archive::new(GzDecoder::new(payload));
    let entries = archive
        .entries()
        .map_err(|error| format!("архив повреждён: {error}"))?;
    for entry in entries {
        let mut entry = entry.map_err(|error| format!("архив повреждён: {error}"))?;
        let path = entry
            .path()
            .map_err(|error| format!("некорректный путь в архиве: {error}"))?
            .to_string_lossy()
            .replace('\\', "/");
        if path.trim_start_matches("./") != member {
            continue;
        }
        let mut bytes = Vec::new();
        entry
            .read_to_end(&mut bytes)
            .map_err(|error| format!("не удалось прочитать «{member}»: {error}"))?;
        return Ok(bytes);
    }
    Err(format!("в архиве отсутствует «{member}»"))
}

fn hex_digest(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "сеть"]
    fn fetches_pdfium_and_reports_digest() {
        let directory = std::env::temp_dir().join("zvs-asset-probe");
        let store = AssetStore::new(&directory);
        let mut seen = Vec::new();
        let path = store
            .ensure(&PDFIUM, &mut |progress| {
                seen.push((progress.stage, progress.downloaded));
            })
            .expect("pdfium должен загрузиться");
        let bytes = std::fs::read(&path).expect("dll читается");
        println!("pdfium.dll: {} байт", bytes.len());
        println!("sha256(dll) = {}", hex_digest(&bytes));
        assert!(bytes.len() > 1_000_000);
        assert!(seen.iter().any(|(stage, _)| *stage == AssetStage::Ready));
    }
}

fn extract_libraries(payload: &[u8], prefix: &str, target: &Path) -> Result<u64, String> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(payload))
        .map_err(|error| format!("Архив повреждён: {error}"))?;
    let mut written = 0_u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Не удалось прочитать архив: {error}"))?;
        let Some(name) = entry.enclosed_name() else {
            continue;
        };
        let name = name.to_string_lossy().replace('\\', "/");
        if !name.starts_with(prefix) || !name.to_ascii_lowercase().ends_with(".dll") {
            continue;
        }
        let Some(file_name) = name.rsplit('/').next() else {
            continue;
        };
        let mut bytes = Vec::with_capacity(entry.size() as usize);
        entry
            .read_to_end(&mut bytes)
            .map_err(|error| format!("Не удалось распаковать {file_name}: {error}"))?;
        let staging = target.join(format!("{file_name}.partial"));
        fs::write(&staging, &bytes)
            .map_err(|error| format!("Не удалось записать {file_name}: {error}"))?;
        fs::rename(&staging, target.join(file_name))
            .map_err(|error| format!("Не удалось сохранить {file_name}: {error}"))?;
        written += bytes.len() as u64;
    }
    Ok(written)
}
