use image::{DynamicImage, imageops::FilterType};
use ndarray::Array4;

use super::detect::TextBox;

pub const TARGET_HEIGHT: u32 = 48;
pub const MIN_WIDTH: u32 = 16;
pub const MAX_WIDTH: u32 = 1600;

pub struct RecognitionBatch {
    pub tensor: Array4<f32>,
    pub count: usize,
}

pub fn crop(image: &DynamicImage, area: &TextBox) -> DynamicImage {
    image.crop_imm(area.left, area.top, area.width(), area.height())
}

pub fn batch_width(crops: &[DynamicImage]) -> u32 {
    crops
        .iter()
        .map(|crop| scaled_width(crop))
        .max()
        .unwrap_or(MIN_WIDTH)
        .clamp(MIN_WIDTH, MAX_WIDTH)
}

pub fn scaled_width(image: &DynamicImage) -> u32 {
    let (width, height) = (image.width().max(1), image.height().max(1));
    let ratio = width as f32 / height as f32;
    ((TARGET_HEIGHT as f32 * ratio).ceil() as u32).clamp(MIN_WIDTH, MAX_WIDTH)
}

pub fn prepare(crops: &[DynamicImage], width: u32) -> RecognitionBatch {
    let mut tensor = Array4::<f32>::zeros((crops.len(), 3, TARGET_HEIGHT as usize, width as usize));
    for (index, crop) in crops.iter().enumerate() {
        let target = scaled_width(crop).min(width);
        let resized = crop
            .resize_exact(target, TARGET_HEIGHT, FilterType::Triangle)
            .to_rgb8();
        for (x, y, pixel) in resized.enumerate_pixels() {
            for channel in 0..3 {
                let value = f32::from(pixel[channel]) / 255.0;
                tensor[[index, channel, y as usize, x as usize]] = (value - 0.5) / 0.5;
            }
        }
    }
    RecognitionBatch {
        tensor,
        count: crops.len(),
    }
}

pub struct Decoded {
    pub text: String,
    pub confidence: f32,
}

pub fn ctc_decode(
    logits: &[f32],
    timesteps: usize,
    classes: usize,
    charset: &[String],
) -> Decoded {
    let mut text = String::new();
    let mut previous = usize::MAX;
    let mut score_total = 0.0_f32;
    let mut scored = 0_usize;
    for step in 0..timesteps {
        let offset = step * classes;
        let mut best = 0_usize;
        let mut best_value = f32::NEG_INFINITY;
        for class in 0..classes {
            let value = logits[offset + class];
            if value > best_value {
                best_value = value;
                best = class;
            }
        }
        if best != 0 && best != previous {
            if let Some(symbol) = charset.get(best) {
                text.push_str(symbol);
                score_total += best_value;
                scored += 1;
            }
        }
        previous = best;
    }
    Decoded {
        text,
        confidence: if scored == 0 {
            0.0
        } else {
            score_total / scored as f32
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn charset() -> Vec<String> {
        ["", "п", "р", "и", "в", "е", "т", " "]
            .iter()
            .map(|value| value.to_string())
            .collect()
    }

    fn logits(sequence: &[usize], classes: usize) -> Vec<f32> {
        let mut values = vec![0.0_f32; sequence.len() * classes];
        for (step, class) in sequence.iter().enumerate() {
            values[step * classes + class] = 1.0;
        }
        values
    }

    #[test]
    fn collapses_repeats_and_drops_the_blank_class() {
        let charset = charset();
        let sequence = [1, 1, 0, 2, 3, 0, 0, 4, 5, 6];
        let decoded = ctc_decode(&logits(&sequence, charset.len()), sequence.len(), charset.len(), &charset);
        assert_eq!(decoded.text, "привет");
    }

    #[test]
    fn keeps_a_repeated_symbol_separated_by_a_blank() {
        let charset = charset();
        let sequence = [2, 0, 2];
        let decoded = ctc_decode(&logits(&sequence, charset.len()), sequence.len(), charset.len(), &charset);
        assert_eq!(decoded.text, "рр");
    }

    #[test]
    fn returns_nothing_for_an_all_blank_sequence() {
        let charset = charset();
        let sequence = [0, 0, 0];
        let decoded = ctc_decode(&logits(&sequence, charset.len()), sequence.len(), charset.len(), &charset);
        assert!(decoded.text.is_empty());
        assert_eq!(decoded.confidence, 0.0);
    }

    #[test]
    fn scales_width_by_aspect_ratio() {
        let wide = DynamicImage::new_rgb8(300, 50);
        assert_eq!(scaled_width(&wide), 288);
        let narrow = DynamicImage::new_rgb8(5, 50);
        assert_eq!(scaled_width(&narrow), MIN_WIDTH);
    }

    #[test]
    fn pads_a_batch_to_the_widest_crop() {
        let crops = vec![
            DynamicImage::new_rgb8(300, 50),
            DynamicImage::new_rgb8(100, 50),
        ];
        let width = batch_width(&crops);
        let batch = prepare(&crops, width);
        assert_eq!(batch.count, 2);
        assert_eq!(batch.tensor.shape()[3], width as usize);
    }
}
