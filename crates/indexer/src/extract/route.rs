use std::collections::HashMap;

const MIN_TEXT_LAYER_CHARS: usize = 96;
const MIN_ALPHANUMERIC_RATIO: f32 = 0.35;
const MAX_DOMINANT_CHAR_RATIO: f32 = 0.25;
const MIN_DISTINCT_CHARS: usize = 12;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PageRoute {
    TextLayer,
    Ocr,
    Empty,
}

impl PageRoute {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TextLayer => "text-layer",
            Self::Ocr => "ocr",
            Self::Empty => "empty",
        }
    }
}

pub fn route_page(text: &str, image_count: usize) -> PageRoute {
    let meaningful = meaningful_chars(text);
    if meaningful >= MIN_TEXT_LAYER_CHARS
        && alphanumeric_ratio(text) >= MIN_ALPHANUMERIC_RATIO
        && !is_degenerate(text)
    {
        return PageRoute::TextLayer;
    }
    if image_count > 0 {
        return PageRoute::Ocr;
    }
    if meaningful > 0 && !is_degenerate(text) {
        return PageRoute::TextLayer;
    }
    if meaningful > 0 {
        return PageRoute::Empty;
    }
    PageRoute::Empty
}

pub fn is_degenerate(text: &str) -> bool {
    let mut counts: HashMap<char, usize> = HashMap::new();
    for value in text.chars().filter(|value| value.is_alphanumeric()) {
        *counts.entry(value.to_lowercase().next().unwrap_or(value)).or_insert(0) += 1;
    }
    let total: usize = counts.values().sum();
    if total < MIN_TEXT_LAYER_CHARS {
        return false;
    }
    if counts.len() < MIN_DISTINCT_CHARS {
        return true;
    }
    let dominant = counts.values().copied().max().unwrap_or(0);
    dominant as f32 / total as f32 > MAX_DOMINANT_CHAR_RATIO
}

fn meaningful_chars(text: &str) -> usize {
    text.chars().filter(|value| !value.is_whitespace()).count()
}

fn alphanumeric_ratio(text: &str) -> f32 {
    let total = meaningful_chars(text);
    if total == 0 {
        return 0.0;
    }
    let alphanumeric = text
        .chars()
        .filter(|value| value.is_alphanumeric())
        .count();
    alphanumeric as f32 / total as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_a_dense_text_layer_to_extraction() {
        let text = "Договор возмездного оказания услуг заключён между сторонами \
                    в городе Москве второго сентября две тысячи двадцать шестого года.";
        assert_eq!(route_page(text, 0), PageRoute::TextLayer);
        assert_eq!(route_page(text, 3), PageRoute::TextLayer);
    }

    #[test]
    fn routes_a_scanned_page_to_ocr() {
        assert_eq!(route_page("", 1), PageRoute::Ocr);
        assert_eq!(route_page("   \n  ", 2), PageRoute::Ocr);
        assert_eq!(route_page("стр. 4", 1), PageRoute::Ocr);
    }

    #[test]
    fn routes_a_blank_page_to_empty() {
        assert_eq!(route_page("", 0), PageRoute::Empty);
        assert_eq!(route_page("\n\t  ", 0), PageRoute::Empty);
    }

    #[test]
    fn keeps_short_text_when_no_image_can_be_recognised() {
        assert_eq!(route_page("Приложение №1", 0), PageRoute::TextLayer);
    }

    #[test]
    fn routes_a_broken_tounicode_layer_to_ocr() {
        let broken: String = "ю".repeat(400);
        assert!(is_degenerate(&broken));
        assert_eq!(route_page(&broken, 1), PageRoute::Ocr);
        assert_eq!(route_page(&broken, 0), PageRoute::Empty);
    }

    #[test]
    fn keeps_dense_cyrillic_prose_as_a_text_layer() {
        let prose = "Администрация муниципального образования город Краснодар                      управление муниципального контроля составила настоящий акт                      по результатам проведённой выездной проверки объекта.";
        assert!(!is_degenerate(prose));
        assert_eq!(route_page(prose, 1), PageRoute::TextLayer);
    }

    #[test]
    fn routes_punctuation_noise_to_ocr_when_images_exist() {
        let noise = "· · · · — — — · · · · — — — · · · · — — — · · · · — — — · · · ·";
        assert_eq!(route_page(noise, 1), PageRoute::Ocr);
    }
}
