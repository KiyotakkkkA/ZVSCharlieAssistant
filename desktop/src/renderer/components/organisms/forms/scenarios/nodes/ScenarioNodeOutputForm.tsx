import type { ReactNode } from "react";
import {
  InputCheckSlided,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { IntegrationProfile } from "../../../../../../shared/models/integration";
import {
  scenarioResponseConfigDtoSchema,
  type ScenarioResponseChannel,
  type ScenarioTriggerConfig,
} from "../../../../../../shared/dto";
import { Field, MailIcon, TelegramIcon } from "../../../../atoms";
import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

interface Props extends ScenarioNodeFormProps {
  triggerConfig: ScenarioTriggerConfig;
  profiles: IntegrationProfile[];
}

const defaultChannel = (
  channel: ScenarioResponseChannel["channel"],
): ScenarioResponseChannel => ({
  channel,
  enabled: false,
  mode: "reply_to_trigger",
  integrationProfileId: null,
  recipient: "",
});

export function ScenarioNodeOutputForm({
  node,
  onChange,
  triggerConfig,
  profiles,
}: Props) {
  const parsed = scenarioResponseConfigDtoSchema.safeParse(
    node.config?.response,
  );
  const channels = parsed.success ? parsed.data.channels : [];
  const patchChannel = (
    channel: ScenarioResponseChannel["channel"],
    patch: Partial<ScenarioResponseChannel>,
  ) => {
    const current =
      channels.find((item) => item.channel === channel) ??
      defaultChannel(channel);
    onChange({
      config: {
        ...node.config,
        response: {
          channels: [
            ...channels.filter((item) => item.channel !== channel),
            { ...current, ...patch },
          ],
        },
      },
    });
  };
  return (
    <div className="space-y-5">
      <ScenarioNodeBaseFields node={node} onChange={onChange} />
      <div>
        <h3 className="text-sm font-semibold text-main-100">
          Куда отправить ответ
        </h3>
        <p className="mt-1 text-xs leading-5 text-main-500">
          Ответ в исходный канал не требует повторного ввода получателя.
        </p>
      </div>
      <ResponseChannelCard
        title="Telegram"
        icon={<TelegramIcon className="size-4" />}
        value={
          channels.find((item) => item.channel === "telegram") ??
          defaultChannel("telegram")
        }
        canReply={triggerConfig.automatic.some(
          (item) => item.kind === "telegram" && item.enabled,
        )}
        profiles={profiles.filter(
          (item) =>
            item.kind === "telegram_bot" &&
            item.enabled &&
            item.status === "connected",
        )}
        recipientPlaceholder="ID чата или пользователя"
        onChange={(patch) => patchChannel("telegram", patch)}
      />
      <ResponseChannelCard
        title="Электронная почта"
        icon={<MailIcon className="size-4" />}
        value={
          channels.find((item) => item.channel === "email") ??
          defaultChannel("email")
        }
        canReply={triggerConfig.automatic.some(
          (item) => item.kind === "email" && item.enabled,
        )}
        profiles={profiles.filter(
          (item) =>
            item.kind === "email_imap" &&
            item.enabled &&
            item.status === "connected",
        )}
        recipientPlaceholder="recipient@example.com"
        onChange={(patch) => patchChannel("email", patch)}
      />
    </div>
  );
}

function ResponseChannelCard({
  title,
  icon,
  value,
  canReply,
  profiles,
  recipientPlaceholder,
  onChange,
}: {
  title: string;
  icon: ReactNode;
  value: ScenarioResponseChannel;
  canReply: boolean;
  profiles: IntegrationProfile[];
  recipientPlaceholder: string;
  onChange(patch: Partial<ScenarioResponseChannel>): void;
}) {
  const modeOptions = [
    ...(canReply
      ? [{ value: "reply_to_trigger", label: "Ответить отправителю" }]
      : []),
    { value: "explicit_recipient", label: "Указать получателя" },
  ];
  const effectiveMode = canReply ? value.mode : "explicit_recipient";
  return (
    <section className="rounded-xl border border-main-700/80 bg-main-800/30 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-main-700/70 text-main-200">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-main-100">{title}</p>
          <p className="text-xs text-main-500">
            {canReply
              ? "Доступен ответ во входящий канал"
              : "Нужен явный получатель"}
          </p>
        </div>
        <InputCheckSlided
          checked={value.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </div>
      {value.enabled ? (
        <div className="mt-4 space-y-3 border-t border-main-700/70 pt-3">
          <Field label="Способ отправки">
            <Select
              value={effectiveMode}
              onChange={(mode) =>
                onChange({ mode: mode as ScenarioResponseChannel["mode"] })
              }
              options={modeOptions}
            >
              <Select.Trigger className="w-full" />
              <Select.Menu>
                {modeOptions.map((option) => (
                  <Select.Option key={option.value} {...option} />
                ))}
              </Select.Menu>
            </Select>
          </Field>
          {effectiveMode === "explicit_recipient" ? (
            <>
              <Field label="Профиль интеграции">
                <Select
                  value={
                    value.integrationProfileId
                      ? String(value.integrationProfileId)
                      : ""
                  }
                  onChange={(id) =>
                    onChange({ integrationProfileId: Number(id) || null })
                  }
                  options={profiles.map((profile) => ({
                    value: String(profile.id),
                    label: profile.name,
                  }))}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Menu>
                    {profiles.map((profile) => (
                      <Select.Option
                        key={profile.id}
                        value={String(profile.id)}
                        label={profile.name}
                      />
                    ))}
                  </Select.Menu>
                </Select>
              </Field>
              <Field label="Получатель">
                <InputSmall
                  className="w-full"
                  value={value.recipient}
                  placeholder={recipientPlaceholder}
                  onChange={(event) =>
                    onChange({ recipient: event.target.value })
                  }
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
