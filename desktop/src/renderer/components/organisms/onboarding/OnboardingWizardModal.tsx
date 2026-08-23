import {
  Alert,
  Badge,
  Button,
  Modal,
  ProgressBar,
} from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { onboardingStore } from "../../../stores";
import { ChevronLeftIcon, CheckIcon, OpenInNewIcon } from "../../atoms";
import { WizardStepFinish } from "./WizardStepFinish";
import { WizardStepPolicies } from "./WizardStepPolicies";
import { WizardStepProfile } from "./WizardStepProfile";
import { WizardStepProvider } from "./WizardStepProvider";
import {
  WizardStepWelcome,
  type OnboardingGoal,
} from "./WizardStepWelcome";

const STEPS = [
  { label: "Цель", description: "Выберите первый результат" },
  { label: "Модель", description: "Подключите провайдера" },
  { label: "Доступ", description: "Задайте безопасные границы" },
  { label: "Профиль", description: "Настройте ответы" },
  { label: "Готово", description: "Перейдите к работе" },
] as const;

export const OnboardingWizardModal = observer(function OnboardingWizardModal() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<OnboardingGoal>("chat");
  const [confirmClose, setConfirmClose] = useState(false);
  const readiness = [
    true,
    onboardingStore.hasProvider,
    onboardingStore.hasDirectoryPolicy || onboardingStore.hasTerminalPolicy,
    onboardingStore.hasProfile,
    false,
  ];
  const currentReady = readiness[step] ?? false;

  const content = [
    <WizardStepWelcome
      key="welcome"
      goal={goal}
      onGoalChange={setGoal}
    />,
    <WizardStepProvider key="provider" />,
    <WizardStepPolicies key="policies" />,
    <WizardStepProfile key="profile" />,
    <WizardStepFinish
      key="finish"
      goal={goal}
      onComplete={onboardingStore.completeWizard}
    />,
  ][step];

  const next = () => setStep((value) => Math.min(STEPS.length - 1, value + 1));

  return (
    <Modal
      open={onboardingStore.wizardOpen}
      onClose={() => setConfirmClose(true)}
      closeOnOverlayClick={false}
      className="h-[min(43rem,90vh)] max-w-4xl overflow-hidden"
      rounded="rounded-3xl"
    >
      <Modal.Header>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-main-50">
            Руководство по настройке
          </h1>
          <Badge>Можно продолжить позже</Badge>
        </div>
      </Modal.Header>
      <Modal.Content className="flex min-h-0 flex-1 p-0!">
        <aside className="w-56 shrink-0 border-r border-main-700/45 bg-main-900/25 p-4">
          <ol className="space-y-1.5">
            {STEPS.map((item, index) => {
              const selected = index === step;
              const done = index < step || readiness[index];
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      selected
                        ? "bg-accent-medium/12 text-main-50 ring-1 ring-accent-light/30"
                        : "text-main-400 hover:bg-main-800/55 hover:text-main-200",
                    ].join(" ")}
                    onClick={() => setStep(index)}
                  >
                    <span
                      className={[
                        "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                        done
                          ? "bg-success-medium/15 text-success-light"
                          : selected
                            ? "bg-accent-medium text-main-950"
                            : "bg-main-700/55 text-main-400",
                      ].join(" ")}
                    >
                      {done ? <CheckIcon className="size-4" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-main-600">
                        {item.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 rounded-xl bg-main-800/35 p-3 text-[11px] leading-5 text-main-500">
            Каждый пункт самостоятельный. Пропущенное останется в списке на
            Главной.
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {confirmClose ? (
            <Alert
              variant="warning"
              title="Закрыть руководство?"
              className="mb-5"
            >
              <p>
                Выполненные настройки сохранятся. Оставшиеся задачи будут
                доступны на Главной.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={() => setConfirmClose(false)}
                >
                  Продолжить настройку
                </Button>
                <Button
                  variant="danger"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={() => void onboardingStore.skipWizard()}
                >
                  Закрыть и продолжить позже
                </Button>
              </div>
            </Alert>
          ) : null}
          {content}
        </div>
      </Modal.Content>

      <Modal.Footer className="block!">
        <ProgressBar
          value={step + 1}
          max={STEPS.length}
          label={`${STEPS[step]?.label} · ${step + 1} из ${STEPS.length}`}
        />
        {step < STEPS.length - 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              rounded="rounded-full"
              className="px-2"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              <ChevronLeftIcon className="size-4" />
              Назад
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && !currentReady ? (
                <Button
                  variant="secondary"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={next}
                >
                  Пропустить этот шаг
                  <OpenInNewIcon className="size-4" />
                </Button>
              ) : null}
              {step === 0 || currentReady ? (
                <Button
                  variant="primary"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={next}
                >
                  {step === 0 ? "Начать настройку" : "Продолжить"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal.Footer>
    </Modal>
  );
});
