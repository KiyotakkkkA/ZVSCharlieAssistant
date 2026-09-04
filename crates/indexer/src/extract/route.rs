const MIN_TEXT_LAYER_CHARS: usize = 96;
const MIN_ALPHANUMERIC_RATIO: f32 = 0.35;

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
    if meaningful >= MIN_TEXT_LAYER_CHARS && alphanumeric_ratio(text) >= MIN_ALPHANUMERIC_RATIO {
        return PageRoute::TextLayer;
    }
    if image_count > 0 {
        return PageRoute::Ocr;
    }
    if meaningful > 0 {
        return PageRoute::TextLayer;
    }
    PageRoute::Empty
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
    fn routes_punctuation_noise_to_ocr_when_images_exist() {
        let noise = "· · · · — — — · · · · — — — · · · · — — — · · · · — — — · · · ·";
        assert_eq!(route_page(noise, 1), PageRoute::Ocr);
    }
}
