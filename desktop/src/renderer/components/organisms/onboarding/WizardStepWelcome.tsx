import { Card } from "@kiyotakkkka/zvs-uikit-lib";
import { BrainIcon, PlanIcon, RobotIcon } from "../../atoms";

export function WizardStepWelcome() {
  const items = [
    [BrainIcon, "Диалог", "Обсуждайте идеи и решайте повседневные задачи."],
    [RobotIcon, "Агенты", "Поручайте исполнителям многошаговую работу."],
    [PlanIcon, "Сценарии", "Автоматизируйте повторяющиеся процессы."],
  ] as const;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-main-50">Добро пожаловать</h2>
        <p className="mt-2 text-sm leading-6 text-main-300">
          ZVS Assistant — локальный ассистент, который умеет вести диалог,
          выполнять задачи агентами и запускать сценарии автоматизации на вашем
          компьютере.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map(([Icon, title, description]) => (
          <Card key={title} className="bg-main-800/50 p-4">
            <Icon className="size-6 text-primary-light" />
            <h3 className="mt-3 text-sm font-medium text-main-100">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-main-400">{description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
