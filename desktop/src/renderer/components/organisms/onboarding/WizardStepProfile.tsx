import {
  Alert,
  Button,
  InputBig,
  InputSmall,
} from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { userProfileStore } from "../../../stores";
import { AccountOutlineIcon, CheckIcon } from "../../atoms";

export const WizardStepProfile = observer(function WizardStepProfile() {
  const [displayName, setDisplayName] = useState(
    userProfileStore.profile?.displayName ?? "",
  );
  const [instructions, setInstructions] = useState(
    userProfileStore.profile?.instructions ?? "",
  );
  const [style, setStyle] = useState(userProfileStore.profile?.style ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await userProfileStore.save({ displayName, instructions, style });
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить профиль.",
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          <AccountOutlineIcon className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-main-50">
            Настройте ответы под себя
          </h2>
          <p className="mt-1 text-sm text-main-400">
            Все поля необязательны; коротких формулировок достаточно.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl bg-main-800/45 p-4 ring-1 ring-main-700/40">
        <label className="block text-xs font-medium text-main-300">
          Как к вам обращаться
          <InputSmall
            className="mt-2 w-full"
            maxLength={120}
            value={displayName}
            placeholder="Например, Ирина"
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="block text-xs font-medium text-main-300">
          Что ассистенту важно учитывать
          <InputBig
            className="mt-2 w-full"
            maxLength={4000}
            minRows={3}
            value={instructions}
            placeholder="Контекст работы, ограничения или постоянные предпочтения"
            onChange={(event) => {
              setInstructions(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label className="block text-xs font-medium text-main-300">
          Стиль ответов
          <InputBig
            className="mt-2 w-full"
            maxLength={2000}
            minRows={2}
            value={style}
            placeholder="Например: кратко, по делу, с примерами кода"
            onChange={(event) => {
              setStyle(event.target.value);
              setSaved(false);
            }}
          />
        </label>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Button
        variant={saved ? "secondary" : "primary"}
        rounded="rounded-full"
        className="px-2"
        loading={userProfileStore.saving}
        onClick={() => void save()}
      >
        <CheckIcon className="size-4" />
        {saved ? "Профиль сохранён" : "Сохранить профиль"}
      </Button>
    </div>
  );
});
