use quick_xml::events::Event;
use quick_xml::Reader;
use std::io::{Cursor, Read};

const DOCUMENT_PART: &str = "word/document.xml";

pub fn extract_docx(bytes: &[u8]) -> Result<String, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|error| {
        format!("Файл повреждён или не является документом Word: {error}")
    })?;
    let mut xml = String::new();
    archive
        .by_name(DOCUMENT_PART)
        .map_err(|_| "В документе Word не найдено содержимое".to_string())?
        .read_to_string(&mut xml)
        .map_err(|error| format!("Не удалось прочитать содержимое документа: {error}"))?;
    Ok(parse_document_xml(&xml))
}

fn parse_document_xml(xml: &str) -> String {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(false);
    let mut paragraphs: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut in_text = false;
    let mut buffer = Vec::new();
    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(tag)) => match local_name(tag.name().as_ref()) {
                b"t" => in_text = true,
                b"tab" => current.push('\t'),
                _ => {}
            },
            Ok(Event::Empty(tag)) => match local_name(tag.name().as_ref()) {
                b"br" | b"cr" => current.push('\n'),
                b"tab" => current.push('\t'),
                _ => {}
            },
            Ok(Event::End(tag)) => match local_name(tag.name().as_ref()) {
                b"t" => in_text = false,
                b"p" => {
                    paragraphs.push(std::mem::take(&mut current));
                }
                _ => {}
            },
            Ok(Event::Text(text)) if in_text => {
                current.push_str(&text.unescape().unwrap_or_default());
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
        buffer.clear();
    }
    if !current.trim().is_empty() {
        paragraphs.push(current);
    }
    paragraphs
        .into_iter()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn local_name(name: &[u8]) -> &[u8] {
    match name.iter().position(|byte| *byte == b':') {
        Some(index) => &name[index + 1..],
        None => name,
    }
}

pub fn extract_plain(bytes: &[u8]) -> String {
    if let Some(stripped) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(stripped).into_owned();
    }
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => encoding_rs::WINDOWS_1251.decode(bytes).0.into_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_paragraphs_and_drops_markup() {
        let xml = r#"<w:document><w:body>
            <w:p><w:r><w:t>Первый абзац</w:t></w:r></w:p>
            <w:p><w:r><w:t>Второй</w:t><w:t xml:space="preserve"> абзац</w:t></w:r></w:p>
        </w:body></w:document>"#;
        assert_eq!(parse_document_xml(xml), "Первый абзац\nВторой абзац");
    }

    #[test]
    fn keeps_line_breaks_inside_a_paragraph() {
        let xml = r#"<w:p><w:r><w:t>Строка</w:t><w:br/><w:t>Другая</w:t></w:r></w:p>"#;
        assert_eq!(parse_document_xml(xml), "Строка\nДругая");
    }

    #[test]
    fn skips_empty_paragraphs() {
        let xml = r#"<w:body><w:p/><w:p><w:r><w:t>Текст</w:t></w:r></w:p><w:p/></w:body>"#;
        assert_eq!(parse_document_xml(xml), "Текст");
    }

    #[test]
    fn reads_utf8_and_cyrillic_ansi_text() {
        assert_eq!(extract_plain("Привет".as_bytes()), "Привет");
        let ansi = encoding_rs::WINDOWS_1251.encode("Привет").0.into_owned();
        assert_eq!(extract_plain(&ansi), "Привет");
    }

    #[test]
    fn strips_the_byte_order_mark() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("Текст".as_bytes());
        assert_eq!(extract_plain(&bytes), "Текст");
    }
}
