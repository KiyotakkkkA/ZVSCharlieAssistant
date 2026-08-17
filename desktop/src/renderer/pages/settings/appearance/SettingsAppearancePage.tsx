import { GlobalSettingsProvider } from "../../../components/atoms";
import { GlobalSettingsAppearanceForm } from "../../../components/organisms/forms";
import { PageHeader } from "../../../components/organisms";

export function SettingsAppearancePage() {
  return (
    <section className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title="Внешний вид"
        description="Настройте интерфейс приложения для максимально комфортной работы."
        breadcrumbs={[{ label: "Настройки" }, { label: "Внешний вид" }]}
      />
      <GlobalSettingsProvider>
        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          <GlobalSettingsAppearanceForm />
        </div>
      </GlobalSettingsProvider>
    </section>
  );
}
