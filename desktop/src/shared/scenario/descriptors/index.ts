import { ScenarioDescriptorRegistry } from "../descriptor-registry";
import { AI_DESCRIPTORS } from "./ai";
import { DATA_DESCRIPTORS } from "./data";
import { FLOW_DESCRIPTORS } from "./flow";
import { OUTPUT_DESCRIPTORS } from "./output";
import { TRIGGER_DESCRIPTORS } from "./triggers";

export * from "./ai";
export * from "./data";
export * from "./flow";
export * from "./output";
export * from "./triggers";

export function createScenarioDescriptorRegistry(): ScenarioDescriptorRegistry {
  return new ScenarioDescriptorRegistry().registerAll([
    ...TRIGGER_DESCRIPTORS,
    ...AI_DESCRIPTORS,
    ...DATA_DESCRIPTORS,
    ...FLOW_DESCRIPTORS,
    ...OUTPUT_DESCRIPTORS,
  ]);
}

export const scenarioDescriptors = createScenarioDescriptorRegistry();

export const CATEGORY_LABELS: Record<string, string> = {
  trigger: "Триггеры",
  ai: "Модели и агенты",
  data: "Данные",
  flow: "Поток управления",
  io: "Ввод-вывод",
  output: "Результат",
};
