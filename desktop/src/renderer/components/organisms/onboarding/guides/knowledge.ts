import { APP_PATHS } from "../../../../app/routes";
import { NumbersIcon } from "../../../atoms";
import type { Guide } from "./types";

export const knowledgeGuide: Guide = {
  id: "knowledge",
  title: "База знаний",
  description: "Поиск по своим документам и подключение их к агенту.",
  result: "Документы проиндексированы, поиск проверен до подключения к агенту.",
  duration: "6 минут",
  icon: NumbersIcon,
  recommendedBefore: ["agents", "providers"],
  steps: [
    {
      id: "knowledge-storage",
      target: "vector-page",
      title: "Раздел «Векторная БД»",
      description:
        "База знаний хранит ваши документы разбитыми на фрагменты. Агент находит подходящие фрагменты по смыслу вопроса и отвечает с опорой на них.",
      points: [
        "Слева выбирается база, справа — её настройки, документы и проверка поиска.",
        "Индексация требует эмбеддинг-модели: включите её у провайдера заранее.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-form",
      target: "knowledge-form",
      title: "Выбор базы",
      description:
        "Заводите отдельную базу под каждый набор документов: смешанные предметные области ухудшают поиск.",
      points: [
        "Настройки сохраняются сразу после выхода из поля — кнопки сохранения нет.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-settings",
      target: "knowledge-settings",
      openTarget: "knowledge-tabs",
      openLabel: "Настройки",
      title: "Параметры индексации",
      description:
        "Фрагмент — это кусок текста, который ищется целиком. Его размер определяет баланс между контекстом и точностью попадания.",
      points: [
        "Крупный фрагмент сохраняет рассуждение целиком, мелкий точнее находит отдельный факт.",
        "Перекрытие повторяет часть текста между соседними фрагментами, чтобы мысль не рвалась на границе.",
        "Векторный поиск ищет по смыслу, гибридный дополнительно учитывает точные слова, номера и артикулы.",
        "После загрузки первого документа модель и размеры фрагментов блокируются: иначе индекс станет разнородным.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-documents",
      target: "knowledge-documents",
      openTarget: "knowledge-tabs",
      openLabel: "Документы",
      title: "Загрузка документов",
      description:
        "Перетащите PDF, DOCX или TXT в область загрузки. Состояние рядом с файлом проходит извлечение текста, индексацию и готовность.",
      points: [
        "Отсканированный PDF без текстового слоя даст пустой результат: сначала распознайте его.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
    {
      id: "knowledge-search",
      target: "knowledge-search",
      openTarget: "knowledge-tabs",
      openLabel: "Тест поиска",
      title: "Проверка поиска",
      description:
        "Задайте вопрос так, как задал бы его агент, и посмотрите на найденные фрагменты. Проверка ничего не меняет в базе.",
      points: [
        "Процент показывает близость к запросу, но пригодность оценивайте по самому тексту фрагмента.",
        "Если нужный ответ не находится — уменьшите размер фрагмента или переключитесь на гибридный поиск.",
      ],
      route: APP_PATHS.storage.vectorDb,
      placement: "left",
    },
  ],
};
