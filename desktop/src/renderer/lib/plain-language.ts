import type { IndexingCapabilities } from "@ipc/contracts";
import type { DownloadId } from "../../shared/models/downloads";

export interface PlainMessage {
  title: string;
  text: string;
  details: string | null;
}

const TECHNICAL_CAUSES: Array<{ match: RegExp; text: string }> = [
  {
    match: /NoKernelImageForDevice|no kernel image is available/i,
    text: "Эта видеокарта новее, чем поддерживает CUDA в текущей версии программы — выберите способ «Видеокарта (DirectML)», он работает на этой карте с той же скоростью.",
  },
  {
    match: /cudnn/i,
    text: "Не хватает библиотек NVIDIA. Выберите способ «Видеокарта NVIDIA (CUDA)» и нажмите «Установить библиотеки».",
  },
  {
    match: /cublas|cudart|nvrtc|cuda_v\d+|cuda runtime/i,
    text: "Не установлен набор библиотек NVIDIA. Выберите способ «Видеокарта NVIDIA (CUDA)» и нажмите «Установить библиотеки».",
  },
  {
    match: /onnxruntime_providers|provider_bridge|LoadLibrary|Error 12[67]/i,
    text: "Рядом с программой не хватает служебных файлов ускорения. Обычно это лечится переустановкой приложения.",
  },
  {
    match: /out of memory|OOM|allocation failed/i,
    text: "Видеокарте не хватило памяти. Закройте игры, браузер или другие программы, которые её нагружают.",
  },
  {
    match: /no such file|не найден указанный модуль|not found/i,
    text: "Не хватает одного из файлов, нужных для работы на видеокарте.",
  },
];

export function explainAccelerationProblem(raw: string | null): PlainMessage {
  const known = raw
    ? TECHNICAL_CAUSES.find((cause) => cause.match.test(raw))
    : undefined;
  return {
    title: "Ошибка настройки ускорения",
    text: known
      ? known.text
      : "Видеокарту подключить не удалось, поэтому документы обрабатывает процессор.",
    details: raw,
  };
}

export function explainProvider(
  capabilities: IndexingCapabilities | null,
): PlainMessage | null {
  if (!capabilities?.assetsReady) return null;
  if (capabilities.ocrProvider === "cuda")
    return {
      title: "Работает на видеокарте",
      text: `Отсканированные страницы распознаёт ${capabilities.deviceName ?? "видеокарта"}.`,
      details: null,
    };
  if (capabilities.ocrProvider === "directml")
    return {
      title: "Работает на видеокарте",
      text: `Отсканированные страницы распознаёт ${capabilities.deviceName ?? "видеокарта"}.`,
      details: null,
    };
  if (capabilities.preference === "cpu")
    return {
      title: "Работает на процессоре",
      text: "Так выбрано в настройках. Документы обрабатываются медленнее, но результат такой же.",
      details: null,
    };
  return explainAccelerationProblem(capabilities.accelerationError);
}

export function explainCudaSupport(
  capabilities: IndexingCapabilities | null,
): PlainMessage | null {
  if (!capabilities?.cudaAvailable) return null;
  if (capabilities.cudaKernelsAvailable !== false) return null;
  return {
    title: "CUDA не подойдёт этой видеокарте",
    text: `${capabilities.deviceName ?? "Видеокарта"} новее, чем поддерживает CUDA в текущей версии программы. Загружать библиотеки NVIDIA не нужно — выберите «Видеокарта (DirectML)».`,
    details: capabilities.computeCapability
      ? `Вычислительная возможность ${capabilities.computeCapability}`
      : null,
  };
}

export function isDownloadNeededOnThisComputer(
  id: DownloadId,
  capabilities: IndexingCapabilities | null,
): boolean {
  return !(
    id === "cuda" &&
    capabilities?.cudaAvailable === true &&
    capabilities.cudaKernelsAvailable === false
  );
}

export function explainMissingAddon(): PlainMessage {
  return {
    title: "Распознавание сканов недоступно",
    text: "Часть программы, которая читает отсканированные документы, не установлена. Переустановите приложение или обратитесь к тому, кто его вам выдал.",
    details: null,
  };
}

export function humanizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|dns/i.test(raw))
    return "Нет связи с интернетом. Проверьте подключение и попробуйте снова.";
  if (/ENOSPC|no space left/i.test(raw)) return "На диске не хватает места.";
  if (/EACCES|EPERM|denied/i.test(raw))
    return "Не хватает прав на запись файлов. Запустите приложение от имени администратора.";
  if (/checksum|sha256|hash mismatch/i.test(raw))
    return "Файл скачался повреждённым. Попробуйте ещё раз.";
  if (/zip file|corrupt|damaged/i.test(raw))
    return "Файл документа повреждён и не читается.";
  if (/не найден текст|no text/i.test(raw))
    return "В документе нет текста. Скорее всего это скан — включите распознавание сканов.";
  return raw;
}

export const PROVIDER_CHOICES = [
  {
    value: "auto",
    label: "Автоматически",
    hint: "Программа сама выберет самый быстрый доступный способ. Подходит почти всем.",
  },
  {
    value: "cuda",
    label: "Видеокарта NVIDIA (CUDA)",
    hint: "Самый быстрый вариант на картах NVIDIA. Требует библиотек NVIDIA — их можно установить здесь же, ниже.",
  },
  {
    value: "directml",
    label: "Видеокарта (DirectML)",
    hint: "Работает на любой современной видеокарте и ничего устанавливать дополнительно не нужно.",
  },
  {
    value: "cpu",
    label: "Только процессор",
    hint: "Самый медленный вариант. Выбирайте, если видеокарта нужна для других задач.",
  },
] as const;
