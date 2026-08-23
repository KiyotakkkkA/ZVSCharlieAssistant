import { APP_PATHS } from "../../../../app/routes";
import { NumbersIcon } from "../../../atoms";
import type { Guide } from "./types";

export const knowledgeGuide: Guide = {
  id: "knowledge",
  title: "Базы знаний",
  description: "Как дать агенту доступ к вашим документам.",
  result: "Вы поймёте, как загрузить документы и использовать их при ответах.",
  duration: "7 минут",
  icon: NumbersIcon,
  recommendedBefore: ["agents", "providers"],
  steps: [
    {
      id: "knowledge-storage",
      target: "vector-page",
      title: "База знаний помогает искать в документах",
      description:
        "Создайте базу, загрузите документы и дождитесь обработки. После этого агент сможет находить подходящие отрывки и учитывать их в ответе.",
      points: [
        "Слева выбирается база, справа находятся её документы и настройки.",
        "Для обработки документов нужна отдельная модель для поиска по смыслу.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-form",
      target: "knowledge-form",
      title: "Выберите существующую базу или создайте новую",
      description:
        "После создания справа открывается форма. Создание базы сохраняет новую пустую запись, поэтому урок не нажимает эту кнопку за вас.",
      points: [
        "Название и описание помогают отличать наборы документов.",
        "Все изменения настроек сохраняются сразу после выбора или выхода из поля.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-settings",
      target: "knowledge-settings",
      openTarget: "knowledge-tabs",
      openLabel: "Настройки",
      title: "Настройки обработки документов",
      description:
        "Модель поиска по смыслу превращает текст в данные для поиска. Размер фрагмента определяет, какими частями читать документ, а перекрытие сохраняет смысл на границе частей.",
      points: [
        "Большой фрагмент хранит больше контекста, маленький точнее находит отдельные факты.",
        "Перекрытие повторяет небольшой кусок текста между соседними фрагментами.",
        "Векторный поиск ищет по смыслу; гибридный дополнительно учитывает точные слова, номера и названия.",
        "После загрузки документов модель и размеры фрагментов блокируются, чтобы индекс оставался согласованным.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-documents",
      target: "knowledge-documents",
      openTarget: "knowledge-tabs",
      openLabel: "Документы",
      title: "Загрузите документы",
      description:
        "Перетащите PDF, DOCX или TXT в область загрузки. Состояние рядом с файлом показывает извлечение текста, обработку и готовность к поиску.",
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-search",
      target: "knowledge-search",
      openTarget: "knowledge-tabs",
      openLabel: "Тест поиска",
      title: "Проверьте качество до подключения к агенту",
      description:
        "Введите обычный вопрос и посмотрите, какие отрывки найдены. Процент показывает близость результата к запросу, но окончательную полезность лучше оценивать по самому тексту.",
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
  ],
};
