import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  InputBig,
  InputSmall,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { Field, GlobalSettingsLabel } from "../../../atoms";
import { PROFILE_ANCHORS } from "./settings-sections";
import { PrimaryButton } from "../../../atoms/buttons";
import { userProfileStore } from "../../../../stores";
import {
  parseIpcDto,
  upsertUserProfileDtoSchema,
  type UpsertUserProfileInput,
} from "../../../../../shared/dto";

const EMPTY: UpsertUserProfileInput = {
  displayName: "",
  instructions: "",
  style: "",
};

export const GlobalSettingsProfileForm = observer(
  function GlobalSettingsProfileForm() {
    const toasts = useToasts();
    const profile = userProfileStore.profile;
    const [model, setModel] = useState<UpsertUserProfileInput>(EMPTY);

    useEffect(() => {
      void userProfileStore.bootstrap();
    }, []);

    useEffect(() => {
      if (!profile) return;
      const { updatedAt: _updatedAt, ...input } = profile;
      setModel(parseIpcDto(upsertUserProfileDtoSchema, input));
    }, [profile]);

    const update = <K extends keyof UpsertUserProfileInput>(
      key: K,
      value: UpsertUserProfileInput[K],
    ) => setModel((current) => ({ ...current, [key]: value }));

    const submit = async (event: React.FormEvent) => {
      event.preventDefault();
      try {
        await userProfileStore.save(model);
        toasts.success({
          title: "Персонализация сохранена",
          description: "Изменения вступят в силу в новом диалоге.",
        });
      } catch (error) {
        toasts.danger({
          title: "Не удалось сохранить",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
      }
    };

    return (
      <form onSubmit={submit} className="space-y-8">
        <section className="space-y-6">
          <Alert variant="info" title="Где это работает">
            Эти настройки подмешиваются в системное сообщение режимов «Чат» и
            «Планировщик» при первом сообщении диалога. У агентов и сценариев
            свои собственные инструкции — на них персонализация не влияет.
          </Alert>

          <GlobalSettingsLabel {...PROFILE_ANCHORS.identity} />

          <div className="space-y-5">
            <Field label="Как к вам обращаться">
              <InputSmall
                placeholder="Например, Захар"
                maxLength={120}
                className="w-full"
                value={model.displayName}
                onChange={(event) => update("displayName", event.target.value)}
              />
            </Field>

            <InputBig
              label="Инструкции для общения"
              description="Что ассистенту стоит знать о вас и ваших задачах, чтобы отвечать полезнее."
              placeholder="Например: я работаю с TypeScript и Electron, отвечай сразу по делу и предлагай готовый код."
              maxLength={4000}
              showCount
              autoResize
              minRows={4}
              maxRows={14}
              value={model.instructions}
              onChange={(event) => update("instructions", event.target.value)}
            />

            <InputBig
              label="Стиль общения"
              description="Тон и формат ответов: насколько подробно, официально или дружелюбно."
              placeholder="Например: коротко, без вступлений, списками, обращение на «ты»."
              maxLength={2000}
              showCount
              autoResize
              minRows={3}
              maxRows={10}
              value={model.style}
              onChange={(event) => update("style", event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <PrimaryButton
              type="submit"
              variant="save"
              label="Сохранить"
              loading={userProfileStore.saving}
            />
          </div>
        </section>
      </form>
    );
  },
);
