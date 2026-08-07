import type { IntegrationKind } from "../../../shared/models/integration";
import type { TextProviderKind } from "../../../shared/dto";
import {
  GithubIcon,
  GitlabIcon,
  MailIcon,
  OllamaIcon,
  OpenrouterIcon,
  StorageIcon,
  TelegramIcon,
} from "../atoms";
import type { SvgIcon } from "../atoms";
import { ControlButton } from "../atoms/buttons";
import { ProvidedEntityStatus } from "src/shared/dto/shared";
import { VectorStoreStatus } from "src/shared/models/vector-store";

type SupportedKind = IntegrationKind | TextProviderKind | "vecstore";

export interface SettingsProvidedEntitySidebarModel {
  id: number | null;
  kind: SupportedKind;
  name: string;
  status: ProvidedEntityStatus | VectorStoreStatus;
}

const MAPPING: Record<SupportedKind, SvgIcon> = {
  ollama: OllamaIcon,
  openrouter: OpenrouterIcon,
  telegram_bot: TelegramIcon,
  email_imap: MailIcon,
  github_connector: GithubIcon,
  gitlab_connector: GitlabIcon,
  vecstore: StorageIcon,
} as const;

const statusMeta: Record<
  ProvidedEntityStatus | VectorStoreStatus,
  { label: string; className: string }
> = {
  connected: { label: "Проверен", className: "text-success-light" },
  ready: { label: "Настроено", className: "text-success-light" },
  unchecked: { label: "Не проверен", className: "text-main-500" },
  disabled: { label: "Не настроено", className: "text-main-500" },
  error: { label: "Ошибка", className: "text-danger-light" },
  indexing: { label: "Индексация", className: "text-accent-light" },
  degraded: { label: "Деградировала", className: "text-danger-light" },
};

const IconResolver = (icon: keyof typeof MAPPING) => {
  const IconComponent = MAPPING[icon];
  return <IconComponent className="size-5" />;
};

export const ProvidedEntitySidebarCard = ({
  model,
  description,
  active,
  onClick,
  onDelete,
  deleteTitle = "Удалить подключение",
}: {
  model: SettingsProvidedEntitySidebarModel | null;
  description?: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
  deleteTitle?: string;
}) => {
  if (model === null) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${active ? "bg-main-700/65" : "hover:bg-main-700/35"}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
        {IconResolver(model.kind)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-main-100">
          {model.name}
        </span>
        {description && (
          <span className="mt-1 block text-xs text-main-500">
            {description}
          </span>
        )}
        <span
          className={`mt-2 block text-[10px] ${statusMeta[model.status].className}`}
        >
          {statusMeta[model.status].label}
        </span>
      </span>
      {model.id !== null ? (
        <span onClick={(event) => event.stopPropagation()}>
          <ControlButton
            icon="trash"
            variant="delete"
            title={deleteTitle}
            onClick={onDelete}
          />
        </span>
      ) : null}
    </div>
  );
};
