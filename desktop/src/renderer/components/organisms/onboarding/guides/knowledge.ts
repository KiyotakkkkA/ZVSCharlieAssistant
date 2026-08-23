import { APP_PATHS } from "../../../../app/routes";
import { NumbersIcon } from "../../../atoms";
import type { Guide } from "./types";

export const knowledgeGuide: Guide = {
  id: "knowledge",
  order: 10,
  title: "Базы знаний",
  description: "Как дать агенту доступ к вашим документам.",
  result: "Вы поймёте, как загрузить документы и использовать их при ответах.",
  duration: "3 минуты",
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
  ],
};
