use image::{DynamicImage, GenericImageView, imageops::FilterType};
use imageproc::region_labelling::{Connectivity, connected_components};
use ndarray::Array4;

const LONG_SIDE: u32 = 960;
const STRIDE: u32 = 32;
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];
const BINARY_THRESHOLD: f32 = 0.3;
const BOX_SCORE_THRESHOLD: f32 = 0.6;
const UNCLIP_RATIO: f32 = 1.5;
const MIN_BOX_SIDE: u32 = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TextBox {
    pub left: u32,
    pub top: u32,
    pub right: u32,
    pub bottom: u32,
}

impl TextBox {
    pub fn width(&self) -> u32 {
        self.right.saturating_sub(self.left)
    }

    pub fn height(&self) -> u32 {
        self.bottom.saturating_sub(self.top)
    }
}

pub struct DetectionInput {
    pub tensor: Array4<f32>,
    pub scale_x: f32,
    pub scale_y: f32,
    pub width: u32,
    pub height: u32,
}

pub fn prepare(image: &DynamicImage) -> DetectionInput {
    let (source_width, source_height) = image.dimensions();
    let longest = source_width.max(source_height) as f32;
    let ratio = if longest > LONG_SIDE as f32 {
        LONG_SIDE as f32 / longest
    } else {
        1.0
    };
    let width = round_to_stride((source_width as f32 * ratio).round() as u32);
    let height = round_to_stride((source_height as f32 * ratio).round() as u32);
    let resized = image
        .resize_exact(width, height, FilterType::Triangle)
        .to_rgb8();

    let mut tensor = Array4::<f32>::zeros((1, 3, height as usize, width as usize));
    for (x, y, pixel) in resized.enumerate_pixels() {
        for channel in 0..3 {
            let value = f32::from(pixel[channel]) / 255.0;
            tensor[[0, channel, y as usize, x as usize]] =
                (value - MEAN[channel]) / STD[channel];
        }
    }
    DetectionInput {
        tensor,
        scale_x: source_width as f32 / width as f32,
        scale_y: source_height as f32 / height as f32,
        width,
        height,
    }
}

pub fn decode(
    probabilities: &[f32],
    map_width: usize,
    map_height: usize,
    input: &DetectionInput,
    source_width: u32,
    source_height: u32,
) -> Vec<TextBox> {
    let mut mask = image::GrayImage::new(map_width as u32, map_height as u32);
    for y in 0..map_height {
        for x in 0..map_width {
            let value = probabilities[y * map_width + x];
            if value > BINARY_THRESHOLD {
                mask.put_pixel(x as u32, y as u32, image::Luma([255]));
            }
        }
    }

    let labels = connected_components(&mask, Connectivity::Eight, image::Luma([0]));
    let mut regions: Vec<Region> = Vec::new();
    for (x, y, pixel) in labels.enumerate_pixels() {
        let label = pixel[0];
        if label == 0 {
            continue;
        }
        let index = label as usize;
        if regions.len() < index {
            regions.resize(index, Region::default());
        }
        let region = &mut regions[index - 1];
        region.absorb(x, y, probabilities[y as usize * map_width + x as usize]);
    }

    let map_scale_x = input.width as f32 / map_width as f32;
    let map_scale_y = input.height as f32 / map_height as f32;

    let mut boxes = Vec::new();
    for region in regions {
        if region.count == 0 {
            continue;
        }
        if region.score() < BOX_SCORE_THRESHOLD {
            continue;
        }
        let expanded = region.unclip();
        let left = expanded.0 * map_scale_x * input.scale_x;
        let top = expanded.1 * map_scale_y * input.scale_y;
        let right = expanded.2 * map_scale_x * input.scale_x;
        let bottom = expanded.3 * map_scale_y * input.scale_y;
        let candidate = TextBox {
            left: left.max(0.0) as u32,
            top: top.max(0.0) as u32,
            right: (right.min(source_width as f32)) as u32,
            bottom: (bottom.min(source_height as f32)) as u32,
        };
        if candidate.width() < MIN_BOX_SIDE || candidate.height() < MIN_BOX_SIDE {
            continue;
        }
        boxes.push(candidate);
    }
    order_boxes(boxes)
}

#[derive(Default, Clone)]
struct Region {
    min_x: u32,
    min_y: u32,
    max_x: u32,
    max_y: u32,
    count: u32,
    score_total: f32,
    initialised: bool,
}

impl Region {
    fn absorb(&mut self, x: u32, y: u32, score: f32) {
        if !self.initialised {
            self.min_x = x;
            self.min_y = y;
            self.max_x = x;
            self.max_y = y;
            self.initialised = true;
        } else {
            self.min_x = self.min_x.min(x);
            self.min_y = self.min_y.min(y);
            self.max_x = self.max_x.max(x);
            self.max_y = self.max_y.max(y);
        }
        self.count += 1;
        self.score_total += score;
    }

    fn score(&self) -> f32 {
        if self.count == 0 {
            return 0.0;
        }
        self.score_total / self.count as f32
    }

    fn unclip(&self) -> (f32, f32, f32, f32) {
        let width = (self.max_x - self.min_x + 1) as f32;
        let height = (self.max_y - self.min_y + 1) as f32;
        let area = width * height;
        let perimeter = 2.0 * (width + height);
        let distance = if perimeter > 0.0 {
            area * UNCLIP_RATIO / perimeter
        } else {
            0.0
        };
        (
            self.min_x as f32 - distance,
            self.min_y as f32 - distance,
            self.max_x as f32 + 1.0 + distance,
            self.max_y as f32 + 1.0 + distance,
        )
    }
}

fn order_boxes(mut boxes: Vec<TextBox>) -> Vec<TextBox> {
    boxes.sort_by_key(|area| (area.top, area.left));
    let mut lines: Vec<Vec<TextBox>> = Vec::new();
    for area in boxes {
        let joined = lines.last_mut().is_some_and(|line| {
            let reference = line[0];
            let limit = reference.height().min(area.height()) as f32 * 0.5;
            if vertical_overlap(&reference, &area) > limit {
                line.push(area);
                true
            } else {
                false
            }
        });
        if !joined {
            lines.push(vec![area]);
        }
    }
    for line in &mut lines {
        line.sort_by_key(|area| area.left);
    }
    lines.into_iter().flatten().collect()
}

fn vertical_overlap(left: &TextBox, right: &TextBox) -> f32 {
    let top = left.top.max(right.top);
    let bottom = left.bottom.min(right.bottom);
    bottom.saturating_sub(top) as f32
}

fn round_to_stride(value: u32) -> u32 {
    let rounded = value.div_ceil(STRIDE) * STRIDE;
    rounded.max(STRIDE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_dimensions_up_to_the_model_stride() {
        assert_eq!(round_to_stride(1), 32);
        assert_eq!(round_to_stride(32), 32);
        assert_eq!(round_to_stride(33), 64);
        assert_eq!(round_to_stride(960), 960);
    }

    #[test]
    fn keeps_small_images_unscaled() {
        let image = DynamicImage::new_rgb8(200, 100);
        let prepared = prepare(&image);
        assert_eq!(prepared.width, 224);
        assert_eq!(prepared.height, 128);
    }

    #[test]
    fn scales_long_images_down_to_the_long_side_budget() {
        let image = DynamicImage::new_rgb8(4000, 2000);
        let prepared = prepare(&image);
        assert!(prepared.width <= LONG_SIDE + STRIDE);
        assert!(prepared.scale_x > 4.0);
    }

    #[test]
    fn expands_a_region_outward_when_unclipping() {
        let mut region = Region::default();
        for x in 10..20 {
            for y in 10..14 {
                region.absorb(x, y, 1.0);
            }
        }
        let (left, top, right, bottom) = region.unclip();
        assert!(left < 10.0);
        assert!(top < 10.0);
        assert!(right > 20.0);
        assert!(bottom > 14.0);
    }

    #[test]
    fn orders_boxes_line_by_line() {
        let boxes = order_boxes(vec![
            TextBox { left: 100, top: 10, right: 200, bottom: 40 },
            TextBox { left: 10, top: 12, right: 90, bottom: 42 },
            TextBox { left: 10, top: 100, right: 90, bottom: 130 },
        ]);
        assert_eq!(boxes[0].left, 10);
        assert_eq!(boxes[0].top, 12);
        assert_eq!(boxes[1].left, 100);
        assert_eq!(boxes[2].top, 100);
    }

    #[test]
    fn orders_many_overlapping_boxes_without_panicking() {
        let boxes: Vec<TextBox> = (0..64)
            .map(|index| TextBox {
                left: (index % 8) * 40,
                top: (index / 8) * 25,
                right: (index % 8) * 40 + 38,
                bottom: (index / 8) * 25 + 30,
            })
            .collect();
        let ordered = order_boxes(boxes);
        assert_eq!(ordered.len(), 64);
        assert!(ordered.windows(2).all(|pair| pair[0].top <= pair[1].top
            || pair[0].left <= pair[1].left));
    }
}
