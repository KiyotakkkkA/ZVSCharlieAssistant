import { Badge, Button } from "@kiyotakkkka/zvs-uikit-lib";
import type { ReactNode } from "react";
import { IntegrationKind, TextProviderKind } from "src/shared/dto";
import {
  SvgIcon,
  OllamaIcon,
  OpenrouterIcon,
  TelegramIcon,
  MailIcon,
  StorageIcon,
  GithubIcon,
  GitlabIcon,
  MistralIcon,
} from "../atoms";
import { PrimaryButton } from "../atoms/basic";

type SupportedKind = IntegrationKind | TextProviderKind | "vecstore";

export interface SettingsProvidedEntityManageModel {
  kind: SupportedKind;
  name: string;
}

const PROVIDER_LABELS: Record<SupportedKind, string> = {
  ollama: "Ollama",
  openrouter: "OpenRouter",
  mistral: "Mistral",
  telegram_bot: "Telegram Bot",
  email_imap: "Email",
  github_connector: "GitHub",
  gitlab_connector: "GitLab",
  vecstore: "",
};

const MAPPING: Record<SupportedKind, SvgIcon> = {
  ollama: OllamaIcon,
  openrouter: OpenrouterIcon,
  mistral: MistralIcon,
  telegram_bot: TelegramIcon,
  email_imap: MailIcon,
  github_connector: GithubIcon,
  gitlab_connector: GitlabIcon,
  vecstore: StorageIcon,
} as const;

const IconResolver = (icon: keyof typeof MAPPING) => {
  const IconComponent = MAPPING[icon];
  return <IconComponent className="size-5" />;
};

export const ProvidedEntityManageHeader = ({
  model,
  description,
  onTest,
  onSave,
  canTest = true,
  canSave = true,
  checking = false,
  saving = false,
  actions,
}: {
  description?: string;
  model: SettingsProvidedEntityManageModel | null;
  onTest?: () => void;
  onSave?: () => void;
  canTest?: boolean;
  canSave?: boolean;
  checking?: boolean;
  saving?: boolean;
  actions?: ReactNode;
}) => {
  if (model === null) return null;

  const label = PROVIDER_LABELS[model.kind] ?? null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-main-700/35 pb-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          {IconResolver(model.kind)}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-main-50">{model.name}</h2>
            {label && (
              <Badge
                rounded="rounded-full"
                className="bg-main-700/60 text-main-300"
              >
                {PROVIDER_LABELS[model.kind]}
              </Badge>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-main-500">{description}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {onTest && (
          <Button
            variant="secondary"
            rounded="rounded-full"
            className="px-4"
            loading={checking}
            loadingText="Проверка…"
            disabled={!canTest || checking}
            onClick={() => void onTest()}
          >
            Проверить подключение
          </Button>
        )}
        {onSave && (
          <PrimaryButton
            variant="save"
            loading={saving}
            label="Сохранить"
            disabled={!canSave || saving}
            onClick={() => void onSave()}
          />
        )}
        {actions}
      </div>
    </div>
  );
};
