use std::{
    collections::HashSet,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

use crate::assets::{
    AssetSpec, CUDA_ASSETS, EMBED_ASSETS, OCR_DET, OCR_REC, OCR_REC_CONFIG, PDFIUM, RERANK_ASSETS,
};

pub const OCR_GROUP: &str = "ocr";
pub const EMBEDDING_GROUP: &str = "embedding";
pub const CUDA_GROUP: &str = "cuda";
pub const RERANK_GROUP: &str = "rerank";

const OCR_ASSETS: [AssetSpec; 4] = [PDFIUM, OCR_DET, OCR_REC, OCR_REC_CONFIG];

pub struct DownloadGroup {
    pub id: &'static str,
    pub specs: &'static [AssetSpec],
    pub download_bytes: i64,
}

pub const GROUPS: [DownloadGroup; 4] = [
    DownloadGroup {
        id: OCR_GROUP,
        specs: &OCR_ASSETS,
        download_bytes: 16_800_000,
    },
    DownloadGroup {
        id: EMBEDDING_GROUP,
        specs: &EMBED_ASSETS,
        download_bytes: 1_151_000_000,
    },
    DownloadGroup {
        id: CUDA_GROUP,
        specs: &CUDA_ASSETS,
        download_bytes: 813_000_000,
    },
    DownloadGroup {
        id: RERANK_GROUP,
        specs: &RERANK_ASSETS,
        download_bytes: 1_153_300_000,
    },
];

pub fn group(id: &str) -> Option<&'static DownloadGroup> {
    GROUPS.iter().find(|entry| entry.id == id)
}

pub fn group_directory(cache_dir: &str, entry: &DownloadGroup) -> PathBuf {
    let root = PathBuf::from(cache_dir);
    entry
        .specs
        .first()
        .map(|spec| root.join(spec.key))
        .unwrap_or(root)
}

static CANCELLED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashSet<String>> {
    CANCELLED.get_or_init(|| Mutex::new(HashSet::new()))
}

pub fn request_cancel(id: &str) {
    if let Ok(mut guard) = registry().lock() {
        guard.insert(id.to_string());
    }
}

pub fn clear_cancel(id: &str) {
    if let Ok(mut guard) = registry().lock() {
        guard.remove(id);
    }
}

pub fn is_cancelled(id: &str) -> bool {
    registry()
        .lock()
        .map(|guard| guard.contains(id))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_every_advertised_group() {
        for entry in GROUPS.iter() {
            assert!(group(entry.id).is_some());
            assert!(!entry.specs.is_empty());
            assert!(entry.download_bytes > 0);
        }
    }

    #[test]
    fn rejects_an_unknown_group() {
        assert!(group("tensorrt").is_none());
    }

    #[test]
    fn remembers_a_cancel_request_until_it_is_cleared() {
        clear_cancel("test-group");
        assert!(!is_cancelled("test-group"));
        request_cancel("test-group");
        assert!(is_cancelled("test-group"));
        clear_cancel("test-group");
        assert!(!is_cancelled("test-group"));
    }

    #[test]
    fn keeps_cancel_requests_independent_per_group() {
        clear_cancel("alpha");
        clear_cancel("beta");
        request_cancel("alpha");
        assert!(is_cancelled("alpha"));
        assert!(!is_cancelled("beta"));
        clear_cancel("alpha");
    }
}
