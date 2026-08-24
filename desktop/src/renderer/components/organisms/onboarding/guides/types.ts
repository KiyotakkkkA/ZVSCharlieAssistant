import type { AppPath } from "../../../../app/routes";
import type { SvgIcon } from "../../../atoms";

/**
 * Шаг урока. Требования к тексту — см. WRITING.md рядом с этим файлом.
 */
export interface GuideStep {
  id: string;
  /** Значение data-tour подсвечиваемого элемента. */
  target: string;
  /** 2–5 слов, именная группа, без точки. */
  title: string;
  /** 1–2 предложения, до 220 символов, действительный залог. */
  description: string;
  /** 0–4 пункта, до 120 символов: ограничение, число, последствие или разбор ошибки. */
  points?: readonly string[];
  route: AppPath;
  openTarget?: string;
  openLabel?: string;
  placement?: "top" | "bottom" | "left" | "right";
  optional?: boolean;
}

export interface Guide {
  id: string;
  /** 1–3 слова, совпадает с названием раздела в меню. */
  title: string;
  /** Одно предложение до 90 символов: чему учит урок. */
  description: string;
  /** Состояние после урока, а не обещание. */
  result: string;
  /** 40–60 секунд на шаг, округление до минуты. */
  duration: string;
  icon: SvgIcon;
  recommendedBefore?: readonly string[];
  steps: readonly GuideStep[];
}
