import type { NodeExecutor } from "../../../../../shared/scenario/node-descriptor";
import type { ScenarioEngineServices } from "../services";
import { DATA_EXECUTORS } from "./data.executors";
import { FLOW_EXECUTORS } from "./flow.executors";
import {
  createAgentExecutor,
  createClassifyExecutor,
  createOrchestratorExecutor,
} from "./ai.executors";
import {
  createDownloadFilesExecutor,
  createHttpExecutor,
  createKnowledgeStoreExecutor,
  createReadFilesExecutor,
} from "./io.executors";
import {
  createApprovalExecutor,
  createSubScenarioExecutor,
} from "./control.executors";
import { createOutputExecutor } from "./output.executors";

export { DATA_EXECUTORS } from "./data.executors";
export { FLOW_EXECUTORS } from "./flow.executors";
export * from "./ai.executors";
export * from "./io.executors";
export * from "./control.executors";
export * from "./output.executors";
export type { ScenarioEngineServices } from "../services";

export function createExecutorMap(
  services: ScenarioEngineServices,
): Map<string, NodeExecutor<never, never>> {
  const list: Array<NodeExecutor<never, never>> = [
    ...FLOW_EXECUTORS,
    ...DATA_EXECUTORS,
    createAgentExecutor(services) as never,
    createOrchestratorExecutor(services) as never,
    createClassifyExecutor(services) as never,
    createHttpExecutor(services) as never,
    createDownloadFilesExecutor(services) as never,
    createReadFilesExecutor(services) as never,
    createKnowledgeStoreExecutor(services) as never,
    createApprovalExecutor(services) as never,
    createSubScenarioExecutor(services) as never,
    createOutputExecutor(services) as never,
  ];
  const map = new Map<string, NodeExecutor<never, never>>();
  for (const executor of list) map.set(executor.kind, executor);
  return map;
}
