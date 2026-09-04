use std::sync::OnceLock;

use napi_derive::napi;
use nvml_wrapper::{Nvml, enum_wrappers::device::TemperatureSensor};

static NVML: OnceLock<Option<Nvml>> = OnceLock::new();

fn nvml() -> Option<&'static Nvml> {
    NVML.get_or_init(|| Nvml::init().ok()).as_ref()
}

pub const MAX_SUPPORTED_COMPUTE_MAJOR: i32 = 9;

#[napi(object)]
pub struct DeviceProbe {
    pub cuda_available: bool,
    pub device_name: Option<String>,
    pub vram_mb: Option<u32>,
    pub driver_version: Option<String>,
    pub compute_capability: Option<String>,
    pub cuda_kernels_available: Option<bool>,
    pub unavailable_reason: Option<String>,
}

impl DeviceProbe {
    fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            cuda_available: false,
            device_name: None,
            vram_mb: None,
            driver_version: None,
            compute_capability: None,
            cuda_kernels_available: None,
            unavailable_reason: Some(reason.into()),
        }
    }
}

pub fn cuda_kernels_supported() -> bool {
    probe_devices().cuda_kernels_available.unwrap_or(true)
}

#[napi]
pub fn probe_devices() -> DeviceProbe {
    let Some(nvml) = nvml() else {
        return DeviceProbe::unavailable("NVML недоступна");
    };
    let count = match nvml.device_count() {
        Ok(count) => count,
        Err(error) => {
            return DeviceProbe::unavailable(format!("Не удалось перечислить GPU: {error}"));
        }
    };
    if count == 0 {
        return DeviceProbe::unavailable("NVIDIA GPU не обнаружены");
    }
    let device = match nvml.device_by_index(0) {
        Ok(device) => device,
        Err(error) => {
            return DeviceProbe::unavailable(format!("Не удалось открыть GPU #0: {error}"));
        }
    };
    let capability = device.cuda_compute_capability().ok();
    DeviceProbe {
        cuda_available: true,
        compute_capability: capability
            .as_ref()
            .map(|value| format!("{}.{}", value.major, value.minor)),
        cuda_kernels_available: capability
            .as_ref()
            .map(|value| value.major <= MAX_SUPPORTED_COMPUTE_MAJOR),
        device_name: device.name().ok(),
        vram_mb: device
            .memory_info()
            .ok()
            .map(|memory| (memory.total / 1_048_576) as u32),
        driver_version: nvml.sys_driver_version().ok(),
        unavailable_reason: None,
    }
}

#[napi(object)]
pub struct GpuSample {
    pub available: bool,
    pub utilization_percent: Option<u32>,
    pub memory_used_mb: Option<u32>,
    pub memory_total_mb: Option<u32>,
    pub temperature_celsius: Option<u32>,
    pub memory_bus_percent: Option<u32>,
}

const UNAVAILABLE_SAMPLE: GpuSample = GpuSample {
    available: false,
    utilization_percent: None,
    memory_used_mb: None,
    memory_total_mb: None,
    temperature_celsius: None,
    memory_bus_percent: None,
};

#[napi]
pub fn sample_gpu() -> GpuSample {
    let Some(nvml) = nvml() else {
        return UNAVAILABLE_SAMPLE;
    };
    let Ok(device) = nvml.device_by_index(0) else {
        return UNAVAILABLE_SAMPLE;
    };
    let utilization = device.utilization_rates().ok();
    let memory = device.memory_info().ok();
    GpuSample {
        available: true,
        utilization_percent: utilization.as_ref().map(|rates| rates.gpu),
        memory_used_mb: memory
            .as_ref()
            .map(|value| (value.used / 1_048_576) as u32),
        memory_total_mb: memory
            .as_ref()
            .map(|value| (value.total / 1_048_576) as u32),
        temperature_celsius: device.temperature(TemperatureSensor::Gpu).ok(),
        memory_bus_percent: utilization.as_ref().map(|rates| rates.memory),
    }
}
