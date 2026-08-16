import { Alert } from "@kiyotakkkka/zvs-uikit-lib";

/**
 * Заглушка вместо прежнего `return "Appearance"`: раздел присутствует в
 * навигации, но настроек внешнего вида пока нет — честнее сказать об этом, чем
 * показывать слово латиницей.
 */
export const SettingsAppearancePage = () => (
  <section className="p-4">
    <Alert variant="info" title="Раздел в разработке">
      Настройки внешнего вида появятся здесь позже. Сейчас приложение использует
      единственную тёмную тему.
    </Alert>
  </section>
);
