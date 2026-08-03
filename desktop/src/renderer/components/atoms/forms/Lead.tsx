interface LeadProps {
  title: string;
  description: string;
  className?: string;
}

export function Lead({ title, description, className = "" }: LeadProps) {
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-main-100">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-main-500">{description}</p>
    </div>
  );
}
