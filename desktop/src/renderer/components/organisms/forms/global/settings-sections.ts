import {
  AccountOutlineIcon,
  ApplicationIcon,
  CogIcon,
  PaletteIcon,
  StorageIcon,
} from "../../../atoms";
import type { GlobalSettingsAnchorDescriptor } from "../../../atoms";

export const APPEARANCE_SECTION = {
  id: "appearance",
  label: "Внешний вид",
  description: "Цветовые схемы, шрифт и размер интерфейса.",
  keywords: ["интерфейс", "оформление", "настройки"],
  icon: PaletteIcon,
};

export const APPEARANCE_ANCHORS = {
  colors: {
    id: "appearance-colors",
    parentId: "appearance",
    label: "Цветовые схемы",
    description: "Выберите палитру приложения для разных условий освещения.",
    keywords: ["цвет", "палитра", "тёмная", "светлая", "тема"],
    icon: PaletteIcon,
  },
  typography: {
    id: "appearance-typography",
    parentId: "appearance",
    label: "Типографика",
    description: "Настройте шрифт и масштаб всего интерфейса.",
    keywords: ["шрифт", "размер", "масштаб", "font"],
    icon: PaletteIcon,
  },
  fontFamily: {
    id: "appearance-font-family",
    parentId: "appearance",
    label: "Шрифт интерфейса",
    description: "Семейство шрифта, которым набран весь интерфейс.",
    keywords: ["font", "onest", "inter", "семейство"],
    icon: PaletteIcon,
  },
  fontSize: {
    id: "appearance-font-size",
    parentId: "appearance",
    label: "Размер интерфейса",
    description: "Общий масштаб текста и элементов.",
    keywords: ["размер", "масштаб", "мелкий", "крупный"],
    icon: PaletteIcon,
  },
} satisfies Record<string, GlobalSettingsAnchorDescriptor>;

export const PROFILE_SECTION = {
  id: "profile",
  label: "Персонализация",
  description: "Как ассистент обращается к вам и в каком тоне отвечает.",
  keywords: ["профиль", "персонализация", "имя", "стиль", "инструкции"],
  icon: AccountOutlineIcon,
};

export const PROFILE_ANCHORS = {
  identity: {
    id: "profile-identity",
    parentId: "profile",
    label: "Профиль",
    description:
      "Заполните только то, что действительно важно — короткие формулировки работают лучше длинных.",
    keywords: ["имя", "обращение", "инструкции", "стиль", "тон"],
    icon: AccountOutlineIcon,
  },
} satisfies Record<string, GlobalSettingsAnchorDescriptor>;

export const APPLICATION_SECTION = {
  id: "application",
  label: "Приложение",
  description: "Поведение приложения и работа системных функций.",
  keywords: ["приложение", "система", "tray", "фон", "закрытие"],
  icon: ApplicationIcon,
};

export const APPLICATION_ANCHORS = {
  background: {
    id: "application-background",
    parentId: "application",
    label: "Фоновая работа",
    description: "Настройте поведение приложения после закрытия окна.",
    keywords: ["фон", "tray", "трей", "закрытие", "сценарии"],
    icon: CogIcon,
  },
  onboarding: {
    id: "application-onboarding",
    parentId: "application",
    label: "Руководство",
    description: "Повторно откройте руководство.",
    keywords: ["онбординг", "тур", "мастер", "помощь", "чеклист"],
    icon: CogIcon,
  },
} satisfies Record<string, GlobalSettingsAnchorDescriptor>;

export const DATA_SECTION = {
  id: "data",
  label: "Данные",
  description: "Перенос и резервное копирование данных приложения.",
  keywords: ["данные", "импорт", "экспорт", "резервная копия", "секреты"],
  icon: StorageIcon,
};

export const DATA_ANCHORS = {
  export: {
    id: "data-export",
    parentId: "data",
    label: "Экспорт данных",
    description: "Создайте защищённую паролем копию категорий и секретов.",
    keywords: ["экспорт", "backup", "копия", "секреты"],
    icon: StorageIcon,
  },
  import: {
    id: "data-import",
    parentId: "data",
    label: "Импорт данных",
    description: "Проверьте и добавьте данные из ранее созданной копии.",
    keywords: ["импорт", "восстановление", "секреты"],
    icon: StorageIcon,
  },
} satisfies Record<string, GlobalSettingsAnchorDescriptor>;
