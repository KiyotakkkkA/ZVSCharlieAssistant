use std::{
    path::{Path, PathBuf},
    sync::{
        OnceLock,
        mpsc::{Receiver, SyncSender, sync_channel},
    },
    thread,
};

use image::DynamicImage;
use pdfium_render::prelude::{
    PdfPageObjectType, PdfPageObjectsCommon, PdfRenderConfig, Pdfium,
};

use super::route::{PageRoute, route_page};

const RENDER_QUEUE_DEPTH: usize = 3;

pub struct ExtractedPage {
    pub number: u16,
    pub text: String,
    pub route: PageRoute,
    pub image: Option<DynamicImage>,
}

pub struct ExtractRequest {
    pub bytes: Vec<u8>,
    pub render_width: i32,
    pub render_for_ocr: bool,
}

enum Command {
    Extract {
        request: ExtractRequest,
        pages: SyncSender<Result<ExtractedPage, String>>,
    },
}

pub struct PdfWorker {
    commands: SyncSender<Command>,
}

static WORKER: OnceLock<PdfWorker> = OnceLock::new();

pub fn worker(library: &Path) -> Result<&'static PdfWorker, String> {
    if let Some(existing) = WORKER.get() {
        return Ok(existing);
    }
    let library = library.to_path_buf();
    let (ready_sender, ready_receiver) = sync_channel::<Result<(), String>>(1);
    let (commands, incoming) = sync_channel::<Command>(0);
    thread::Builder::new()
        .name("zvs-pdfium".into())
        .spawn(move || run(library, ready_sender, incoming))
        .map_err(|error| format!("Не удалось запустить поток pdfium: {error}"))?;
    ready_receiver
        .recv()
        .map_err(|_| "Поток pdfium завершился при запуске".to_string())??;
    let _ = WORKER.set(PdfWorker { commands });
    WORKER
        .get()
        .ok_or_else(|| "Поток pdfium недоступен".to_string())
}

impl PdfWorker {
    pub fn extract(
        &self,
        request: ExtractRequest,
    ) -> Result<Receiver<Result<ExtractedPage, String>>, String> {
        let (pages, incoming) = sync_channel(RENDER_QUEUE_DEPTH);
        self.commands
            .send(Command::Extract { request, pages })
            .map_err(|_| "Поток pdfium остановлен".to_string())?;
        Ok(incoming)
    }
}

fn run(library: PathBuf, ready: SyncSender<Result<(), String>>, incoming: Receiver<Command>) {
    let bindings = match Pdfium::bind_to_library(&library) {
        Ok(bindings) => bindings,
        Err(error) => {
            let _ = ready.send(Err(format!("Не удалось загрузить pdfium: {error}")));
            return;
        }
    };
    let pdfium = Pdfium::new(bindings);
    if ready.send(Ok(())).is_err() {
        return;
    }
    while let Ok(command) = incoming.recv() {
        let Command::Extract { request, pages } = command;
        extract_document(&pdfium, request, &pages);
    }
}

fn extract_document(
    pdfium: &Pdfium,
    request: ExtractRequest,
    pages: &SyncSender<Result<ExtractedPage, String>>,
) {
    let document = match pdfium.load_pdf_from_byte_slice(&request.bytes, None) {
        Ok(document) => document,
        Err(error) => {
            let _ = pages.send(Err(format!("Не удалось открыть PDF: {error}")));
            return;
        }
    };
    let config = PdfRenderConfig::new().set_target_width(request.render_width);
    for (index, page) in document.pages().iter().enumerate() {
        let number = u16::try_from(index + 1).unwrap_or(u16::MAX);
        let text = page
            .text()
            .map(|layer| layer.all())
            .unwrap_or_default()
            .replace('\u{0}', " ");
        let images = page
            .objects()
            .iter()
            .filter(|object| object.object_type() == PdfPageObjectType::Image)
            .count();
        let route = route_page(&text, images);
        let image = if route == PageRoute::Ocr && request.render_for_ocr {
            match page.render_with_config(&config) {
                Ok(bitmap) => Some(bitmap.as_image()),
                Err(error) => {
                    let _ = pages.send(Err(format!(
                        "Не удалось растрировать страницу {number}: {error}"
                    )));
                    continue;
                }
            }
        } else {
            None
        };
        if pages
            .send(Ok(ExtractedPage {
                number,
                text,
                route,
                image,
            }))
            .is_err()
        {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assets::{AssetStore, PDFIUM};

    fn library() -> PathBuf {
        let store = AssetStore::new(std::env::temp_dir().join("zvs-asset-probe"));
        store
            .ensure(&PDFIUM, &mut |_| {})
            .expect("pdfium должен быть доступен")
    }

    #[test]
    #[ignore = "требует ZVS_PDF_FIXTURE"]
    fn reports_routing_for_a_real_document() {
        let Ok(fixture) = std::env::var("ZVS_PDF_FIXTURE") else {
            panic!("укажите ZVS_PDF_FIXTURE");
        };
        let bytes = std::fs::read(&fixture).expect("файл читается");
        let worker = worker(&library()).expect("поток pdfium запускается");
        let pages = worker
            .extract(ExtractRequest {
                bytes,
                render_width: 1600,
                render_for_ocr: false,
            })
            .expect("извлечение стартует");

        let mut text_layer = 0;
        let mut ocr = 0;
        let mut empty = 0;
        let mut characters = 0;
        let mut sample = String::new();
        for page in pages {
            let page = page.expect("страница читается");
            characters += page.text.chars().count();
            match page.route {
                PageRoute::TextLayer => text_layer += 1,
                PageRoute::Ocr => ocr += 1,
                PageRoute::Empty => empty += 1,
            }
            if sample.is_empty() && !page.text.trim().is_empty() {
                sample = page.text.chars().take(70).collect();
            }
        }
        println!(
            "страниц: text-layer={text_layer} ocr={ocr} empty={empty}, символов={characters}"
        );
        println!("начало: {}", sample.replace('\n', " "));
        assert!(text_layer + ocr + empty > 0);
    }
}
