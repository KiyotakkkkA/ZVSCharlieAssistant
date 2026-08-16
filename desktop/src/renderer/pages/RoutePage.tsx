import { Alert } from "@kiyotakkkka/zvs-uikit-lib";

interface RoutePageProps {
  title: string;
  description?: string;
}

export function RoutePage({ title, description }: RoutePageProps) {
  return (
    <section className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-main-100">{title}</h1>
      <Alert variant="info" title="Раздел в разработке">
        {description ?? "Выберите нужный пункт в боковом меню."}
      </Alert>
    </section>
  );
}
