import { InputBig, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { userProfileStore } from "../../../stores";

export const WizardStepProfile = observer(function WizardStepProfile({
  onSavingChange,
}: {
  onSavingChange: (saving: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [style, setStyle] = useState("");

  useEffect(() => {
    const profile = userProfileStore.profile;
    if (!profile) return;
    setDisplayName(profile.displayName);
    setInstructions(profile.instructions);
    setStyle(profile.style);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!displayName.trim() && !instructions.trim() && !style.trim()) return;
      onSavingChange(true);
      void userProfileStore
        .save({ displayName, instructions, style })
        .finally(() => onSavingChange(false));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [displayName, instructions, style, onSavingChange]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-main-50">Расскажите о себе</h2>
        <p className="mt-1 text-sm text-main-400">
          Заполните только то, что действительно важно.
        </p>
      </div>
      <label className="block text-xs text-main-300">
        Как к вам обращаться
        <InputSmall className="mt-1 w-full" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label className="block text-xs text-main-300">
        Важные инструкции
        <InputBig className="mt-1 w-full" maxLength={4000} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
      </label>
      <label className="block text-xs text-main-300">
        Предпочтительный стиль ответов
        <InputBig className="mt-1 w-full" maxLength={2000} value={style} onChange={(event) => setStyle(event.target.value)} />
      </label>
    </div>
  );
});
