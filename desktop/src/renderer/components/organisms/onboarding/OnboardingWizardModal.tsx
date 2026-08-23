import { Alert, Button, Modal, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";
import { onboardingStore, textProviderStore } from "../../../stores";
import { WizardStepFinish } from "./WizardStepFinish";
import { WizardStepPolicies } from "./WizardStepPolicies";
import { WizardStepProfile } from "./WizardStepProfile";
import { WizardStepProvider } from "./WizardStepProvider";
import { WizardStepWelcome } from "./WizardStepWelcome";

const labels = ["Знакомство", "Профиль", "Модель", "Безопасность", "Готово"];

export const OnboardingWizardModal = observer(function OnboardingWizardModal() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const onSavingChange = useCallback((value: boolean) => setSaving(value), []);
  const complete = () => onboardingStore.completeWizard();
  const requestClose = () => setConfirmSkip(true);
  const content = [
    <WizardStepWelcome key="welcome" />,
    <WizardStepProfile key="profile" onSavingChange={onSavingChange} />,
    <WizardStepProvider key="provider" />,
    <WizardStepPolicies key="policies" />,
    <WizardStepFinish key="finish" onComplete={complete} />,
  ][step];
  const nextLabel = step === 0 ? "Начать настройку" : step === 2 && !textProviderStore.enabledModels.length ? "Настрою позже" : "Далее";

  return (
    <Modal open={onboardingStore.wizardOpen} onClose={requestClose} closeOnOverlayClick={false} className="h-[min(38rem,86vh)] max-w-3xl overflow-hidden" rounded="rounded-3xl">
      <Modal.Header><h1 className="text-base font-semibold text-main-50">Первичная настройка</h1></Modal.Header>
      <Modal.Content className="flex min-h-0 flex-1 p-0!">
        <aside className="w-48 shrink-0 border-r border-main-700/50 bg-main-800/35 p-4">
          <ol className="space-y-2">
            {labels.map((label, index) => (
              <li key={label} className={["rounded-lg px-3 py-2 text-xs", index === step ? "bg-primary-medium/15 text-primary-light" : index < step ? "text-main-300" : "text-main-500"].join(" ")}>{index + 1}. {label}</li>
            ))}
          </ol>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto p-6">{confirmSkip ? <Alert variant="warning" title="Пропустить мастер?" className="mb-4">Настройку можно снова открыть через кнопку помощи.<div className="mt-3 flex gap-2"><Button variant="danger" onClick={() => void onboardingStore.skipWizard()}>Пропустить</Button><Button variant="ghost" onClick={() => setConfirmSkip(false)}>Продолжить настройку</Button></div></Alert> : null}{content}</div>
      </Modal.Content>
      <Modal.Footer className="block!">
        <ProgressBar value={step + 1} max={labels.length} label={`Шаг ${step + 1} из ${labels.length}`} />
        {step < labels.length - 1 ? <div className="mt-4 flex justify-between gap-3"><Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((value) => Math.max(0, value - 1))}>Назад</Button><div className="flex gap-2"><Button variant="ghost" disabled={saving} onClick={requestClose}>Пропустить</Button><Button variant="primary" loading={saving} onClick={() => setStep((value) => Math.min(labels.length - 1, value + 1))}>{nextLabel}</Button></div></div> : null}
      </Modal.Footer>
    </Modal>
  );
});
