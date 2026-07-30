interface RoutePageProps {
  title: string;
}

export function RoutePage({ title }: RoutePageProps) {
  return (
    <section className="p-2">
      <h1 className="text-xl font-semibold">{title}</h1>
    </section>
  );
}
