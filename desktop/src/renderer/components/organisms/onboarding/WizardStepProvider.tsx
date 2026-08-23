import { Alert, Button } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../../app/routes";
import { textProviderStore } from "../../../stores";

export const WizardStepProvider = observer(function WizardStepProvider() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-main-50">Подключите модель</h2>
        <p className="mt-2 text-sm leading-6 text-main-300">
          Модель отвечает в чате и помогает агентам. Настройте Ollama,
          OpenRouter или Mistral в единой форме провайдеров.
        </p>
      </div>
      {textProviderStore.enabledModels.length ? (
        <Alert variant="success" title="Модель подключена">
          Доступно моделей: {textProviderStore.enabledModels.length}.
        </Alert>
      ) : (
        <Alert variant="warning" title="Без модели чат не сможет отвечать">
          Откройте настройки, проверьте подключение и включите хотя бы одну
          модель. Затем вернитесь в мастер.
        </Alert>
      )}
      <Button variant="primary" onClick={() => navigate(APP_PATHS.settings.providers)}>
        Настроить провайдера
      </Button>
      <p className="text-xs text-main-500">
        Можно продолжить без модели кнопкой «Настрою позже».
      </p>
    </div>
  );
});
