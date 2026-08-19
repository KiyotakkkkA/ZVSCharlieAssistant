import { AccountOutlineIcon, PaletteIcon } from "../../../atoms";
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
