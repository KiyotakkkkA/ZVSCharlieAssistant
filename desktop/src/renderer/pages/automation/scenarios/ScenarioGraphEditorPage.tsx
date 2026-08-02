import {
  type SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyEdgeChanges,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import {
  Button,
  InputBig,
  InputSmall,
  Select,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useParams } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { toJS } from "mobx";
import {
  ChatIcon,
  ChevronLeftIcon,
  ClockIcon,
  PlusIcon,
  RobotIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  TasksIcon,
  StorageIcon,
  Field,
} from "../../../components/atoms";
import {
  DangerModal,
  ScenarioGraphCanvas,
  type ScenarioFlowEdge,
  type ScenarioFlowNode,
} from "../../../components/organisms";
import { APP_PATHS } from "../../../app/routes";
import { useHashRouter } from "../../../hooks";
import { automationStore, vectorStoreStore } from "../../../stores";
import type {
  AutomationStatus,
  AutomationScenarioEdge as GraphEdge,
  AutomationScenarioNode as GraphNode,
  AutomationScenarioNodeKind as NodeKind,
} from "../../../../ipc/contracts";

const nodeMeta: Record<
  NodeKind,
  {
    label: string;
    color: string;
    dot: string;
    icon: (props: SVGProps<SVGSVGElement>) => React.ReactNode;
  }
> = {
  trigger: {
    label: "Триггер",
    color: "text-amber-200 bg-amber-400/10",
    dot: "bg-amber-300",
    icon: (props) => <ChatIcon {...props} />,
  },
  orchestrator: {
    label: "Оркестратор",
    color: "text-violet-200 bg-violet-400/10",
    dot: "bg-violet-300",
    icon: (props) => <RobotIcon {...props} />,
  },
  agent: {
    label: "Агент",
    color: "text-violet-200 bg-violet-400/10",
    dot: "bg-violet-300",
    icon: (props) => <RobotIcon {...props} />,
  },
  knowledge_store: {
    label: "Хранилище",
    color: "text-cyan-200 bg-cyan-400/10",
    dot: "bg-cyan-300",
    icon: (props) => <StorageIcon {...props} />,
  },
  condition: {
    label: "Условие",
    color: "text-sky-200 bg-sky-400/10",
    dot: "bg-sky-300",
    icon: (props) => <SettingsIcon {...props} />,
  },
  approval: {
    label: "Подтверждение",
    color: "text-lime-200 bg-lime-400/10",
    dot: "bg-lime-300",
    icon: (props) => <TasksIcon {...props} />,
  },
  output: {
    label: "Результат",
    color: "text-emerald-200 bg-emerald-400/10",
    dot: "bg-emerald-300",
    icon: (props) => <SendIcon {...props} />,
  },
};

const initialNodes: GraphNode[] = [
  {
    id: "chat-trigger",
    kind: "trigger",
    title: "Новое сообщение",
    description: "Запуск из чата",
    x: 70,
    y: 250,
  },
  {
    id: "orchestrator",
    kind: "orchestrator",
    title: "Оркестратор",
    description: "Анализирует задачу",
    x: 330,
    y: 250,
  },
  {
    id: "response",
    kind: "output",
    title: "Ответ пользователю",
    description: "Возвращает результат",
    x: 590,
    y: 250,
  },
];

const palette: Array<{ kind: NodeKind; title: string; description: string }> = [
  { kind: "agent", title: "Вызов агента", description: "Делегирование задачи" },
  {
    kind: "knowledge_store",
    title: "База знаний",
    description: "Контекст для агента",
  },
  {
    kind: "condition",
    title: "Условие",
    description: "Выбор следующей ветки",
  },
  {
    kind: "approval",
    title: "Подтверждение",
    description: "Решение пользователя",
  },
  { kind: "output", title: "Результат", description: "Завершение ветки" },
];

const scenarioStatusOptions = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Активен" },
  { value: "disabled", label: "Отключён" },
];

export const ScenarioGraphEditorPage = observer(
  function ScenarioGraphEditorPage() {
    const { goTo } = useHashRouter();
    const toasts = useToasts();
    const { scenarioId } = useParams();
    const scenario = automationStore.getScenario(scenarioId);
    const [nodes, setNodes] = useState<GraphNode[]>(() =>
      scenario?.graph.nodes.length ? toJS(scenario.graph.nodes) : initialNodes,
    );
    const [edges, setEdges] = useState<GraphEdge[]>(() =>
      scenario ? toJS(scenario.graph.edges) : [],
    );
    const [selectedNodeId, setSelectedNodeId] = useState("orchestrator");
    const [status, setStatus] = useState<AutomationStatus>(
      scenario?.status ?? "draft",
    );

    useEffect(() => {
      if (!scenario) return;
      setNodes(toJS(scenario.graph.nodes));
      setEdges(toJS(scenario.graph.edges));
      setSelectedNodeId(scenario.graph.nodes[0]?.id ?? "");
      setStatus(scenario.status);
    }, [scenario]);

    const selectedNode = nodes.find((node) => node.id === selectedNodeId);

    const deleteEdge = useCallback((edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    }, []);
    const deleteNode = useCallback((nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
      setSelectedNodeId((current) => (current === nodeId ? "" : current));
    }, []);

    const flowNodes = useMemo<ScenarioFlowNode[]>(
      () =>
        nodes.map((node) => ({
          id: node.id,
          type: "scenario",
          position: { x: node.x, y: node.y },
          data: {
            node,
            runStatus: automationStore.scenarioNodeRuns.find(
              (run) => run.nodeId === node.id,
            )?.status,
            onDelete:
              node.kind === "trigger" || node.kind === "orchestrator"
                ? undefined
                : deleteNode,
          },
          selected: node.id === selectedNodeId,
          deletable: node.kind !== "trigger" && node.kind !== "orchestrator",
          width: 210,
          height: 98,
          measured: { width: 210, height: 98 },
        })),
      [nodes, selectedNodeId, automationStore.scenarioNodeRuns, deleteNode],
    );
    const flowEdges = useMemo<ScenarioFlowEdge[]>(
      () =>
        edges.map((edge) => ({
          ...edge,
          sourceHandle: edge.sourcePort,
          targetHandle: edge.targetPort,
          type: "scenario",
          animated: automationStore.activeScenarioRun?.status === "running",
          style: { stroke: "rgb(139 173 77)", strokeWidth: 1.5 },
          data: {
            edgeId: edge.id,
            kind: edge.kind,
            onDelete: deleteEdge,
          },
        })),
      [edges, automationStore.activeScenarioRun?.status, deleteEdge],
    );
    const onNodesChange: OnNodesChange<ScenarioFlowNode> = useCallback(
      (changes) => {
        const removed = new Set(
          changes
            .filter((change) => change.type === "remove")
            .map((change) => change.id),
        );
        setNodes((current) =>
          current
            .filter((node) => !removed.has(node.id))
            .map((node) => {
              const position = changes.find(
                (change) => change.type === "position" && change.id === node.id,
              );
              return position?.type === "position" && position.position
                ? { ...node, x: position.position.x, y: position.position.y }
                : node;
            }),
        );
        if (removed.size)
          setEdges((current) =>
            current.filter(
              (edge) => !removed.has(edge.source) && !removed.has(edge.target),
            ),
          );
      },
      [],
    );
    const onEdgesChange: OnEdgesChange<ScenarioFlowEdge> = useCallback(
      (changes) => {
        const next = applyEdgeChanges(changes, flowEdges);
        setEdges(
          next.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            kind: edge.data?.kind ?? "control",
            sourcePort: edge.sourceHandle ?? undefined,
            targetPort: edge.targetHandle ?? undefined,
          })),
        );
      },
      [flowEdges],
    );
    const onConnect = useCallback(
      (connection: Connection) => {
        if (!connection.source || !connection.target) return;
        const sourceKind = nodes.find(
          (node) => node.id === connection.source,
        )?.kind;
        const targetKind = nodes.find(
          (node) => node.id === connection.target,
        )?.kind;
        const kind =
          connection.sourceHandle === "knowledge-out" &&
          connection.targetHandle === "knowledge-in"
            ? "knowledge"
            : (sourceKind === "orchestrator" || sourceKind === "agent") &&
                targetKind === "agent"
              ? "worker"
              : "control";
        setEdges((current) => {
          if (
            current.some(
              (edge) =>
                edge.source === connection.source &&
                edge.target === connection.target &&
                edge.kind === kind,
            )
          )
            return current;
          return [
            ...current,
            {
              id: `edge-${crypto.randomUUID()}`,
              source: connection.source!,
              target: connection.target!,
              kind,
              sourcePort: connection.sourceHandle ?? undefined,
              targetPort: connection.targetHandle ?? undefined,
            },
          ];
        });
      },
      [nodes],
    );

    const addNode = (kind: NodeKind, title: string) => {
      const id = `${kind}-${crypto.randomUUID()}`;
      setNodes((current) => [
        ...current,
        {
          id,
          kind,
          title,
          description: "Настройте новый узел",
          x: 410 + (current.length % 3) * 36,
          y: 170 + (current.length % 4) * 92,
        },
      ]);
      setSelectedNodeId(id);
    };

    const updateSelectedNode = (patch: Partial<GraphNode>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId ? { ...node, ...patch } : node,
        ),
      );
    };

    const saveScenario = async () => {
      try {
        const saved = await automationStore.upsertScenario({
          id: scenario?.id,
          name: scenario?.name ?? "Новый сценарий",
          description:
            scenario?.description ??
            "Новый сценарий автоматизации с вызовом агентов.",
          status,
          graph: {
            nodes,
            edges,
            viewport: scenario?.graph.viewport ?? { x: 0, y: 0, zoom: 1 },
          },
          toolSettings: scenario?.toolSettings ?? [],
        });
        if (!scenarioId) {
          goTo(
            APP_PATHS.automation.scenarios.edit.replace(
              ":scenarioId",
              saved.id,
            ),
            { replace: true },
          );
        }
        toasts.success({ title: "Сценарий сохранён" });
        return saved;
      } catch (error) {
        toasts.danger({
          title: "Не удалось сохранить сценарий",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
        return undefined;
      }
    };

    const validateScenario = async () => {
      const result = await automationStore.validateScenario({ nodes, edges });
      if (result.valid) toasts.success({ title: "Граф готов к запуску" });
      else
        toasts.danger({
          title: "Граф содержит ошибки",
          description: result.issues.map((issue) => issue.message).join(" · "),
        });
      return result.valid;
    };

    const runScenario = async () => {
      if (!(await validateScenario())) return;
      const saved = await saveScenario();
      if (!saved) return;
      await automationStore.startScenario(saved.id, {
        message: "Ручной запуск сценария",
      });
      toasts.success({ title: "Сценарий запущен в фоне" });
    };

    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-main-900">
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-main-800 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              label="Назад к агентам"
              className="size-9 shrink-0 p-0 text-main-400"
              onClick={() => goTo(APP_PATHS.automation.scenarios.index)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-violet-200">
              <RobotIcon className="size-4" />
            </span>
            <div className="min-w-0 flex gap-3">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-main-100">
                  {scenario?.name ?? "Новый сценарий"}
                </h1>
              </div>
              <Select
                className="w-30 shrink-0"
                value={status}
                onChange={(value) => setStatus(value as AutomationStatus)}
                options={scenarioStatusOptions}
              >
                <Select.Trigger
                  rounded="rounded-full"
                  className="h-7 w-full border-0! bg-main-800/80 px-2.5 text-[11px] shadow-none ring-0! hover:bg-main-700"
                />
                <Select.Menu rounded="rounded-xl">
                  {scenarioStatusOptions.map((option) => (
                    <Select.Option key={option.value} {...option} />
                  ))}
                </Select.Menu>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                className="px-2"
                variant="ghost"
                onClick={() => void saveScenario()}
              >
                <SaveIcon className="size-4" />
                Сохранить
              </Button>
              <Button
                variant="secondary"
                className="px-2"
                onClick={() => void validateScenario()}
              >
                Проверить
              </Button>
              <Button
                variant="primary"
                className="px-2"
                onClick={() => void runScenario()}
              >
                <SendIcon className="size-4" />
                Запустить
              </Button>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col border-r border-main-800 bg-main-900/80 p-3">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-main-500 mb-3">
              Узлы
            </h2>
            <InputSmall
              preset="search"
              placeholder="Поиск узлов"
              className="w-full"
            />

            <div className="mt-4 space-y-1.5 overflow-auto">
              {palette.map((item) => {
                const meta = nodeMeta[item.kind];
                return (
                  <button
                    key={item.kind}
                    type="button"
                    className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-main-800/70"
                    onClick={() => addNode(item.kind, item.title)}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${meta.color}`}
                    >
                      {meta.icon({ className: "size-4" })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-main-200">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-main-500">
                        {item.description}
                      </span>
                    </span>
                    <PlusIcon className="size-3.5 text-main-600 group-hover:text-main-300" />
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-lg bg-main-800/35 p-3 text-xs leading-5 text-main-500">
              Выберите узел для настройки. Перетаскивайте узлы по рабочей
              области.
            </div>
          </aside>

          <ScenarioGraphCanvas
            key={scenario?.revisionId ?? "new-scenario"}
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeSelect={setSelectedNodeId}
          />

          <aside className="w-72 shrink-0 overflow-auto border-l border-main-800 bg-main-900/90">
            <div className="flex h-12 items-center justify-between border-b border-main-800 px-4">
              <h2 className="text-sm font-semibold text-main-200">Настройки</h2>
              <SettingsIcon className="size-4 text-main-500" />
            </div>
            {selectedNode ? (
              <div className="space-y-5 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-10 place-items-center rounded-lg ${nodeMeta[selectedNode.kind].color}`}
                  >
                    {nodeMeta[selectedNode.kind].icon({ className: "size-4" })}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-main-100">
                      {nodeMeta[selectedNode.kind].label}
                    </p>
                    <p className="text-xs text-main-500">{selectedNode.id}</p>
                  </div>
                </div>

                <Field label="Название">
                  <InputSmall
                    value={selectedNode.title}
                    onChange={(event) =>
                      updateSelectedNode({ title: event.target.value })
                    }
                  />
                </Field>
                <Field label="Описание">
                  <InputBig
                    value={selectedNode.description}
                    onChange={(event) =>
                      updateSelectedNode({ description: event.target.value })
                    }
                    minRows={3}
                    maxRows={6}
                    autoResize
                  />
                </Field>
                {selectedNode.kind === "agent" ? (
                  <>
                    <Field label="Агент">
                      <Select
                        value={String(selectedNode.config?.agentId ?? "")}
                        onChange={(agentId) =>
                          updateSelectedNode({
                            config: { ...selectedNode.config, agentId },
                            description:
                              automationStore.agents.find(
                                (agent) => agent.id === agentId,
                              )?.name ?? selectedNode.description,
                          })
                        }
                        options={automationStore.agents.map((agent) => ({
                          value: agent.id,
                          label: agent.name,
                        }))}
                        placeholder="Выберите агента"
                        searchable
                      >
                        <Select.Trigger className="w-full" />
                        <Select.Menu>
                          {automationStore.agents.map((agent) => (
                            <Select.Option
                              key={agent.id}
                              value={agent.id}
                              label={agent.name}
                            />
                          ))}
                        </Select.Menu>
                      </Select>
                    </Field>
                    <Field label="Инструкции для сценария">
                      <InputBig
                        value={String(
                          selectedNode.config?.scenarioInstructions ?? "",
                        )}
                        onChange={(event) =>
                          updateSelectedNode({
                            config: {
                              ...selectedNode.config,
                              scenarioInstructions: event.target.value,
                            },
                          })
                        }
                        placeholder="Уточните роль агента, формат и ограничения результата"
                        minRows={4}
                        maxRows={9}
                        autoResize
                      />
                    </Field>
                  </>
                ) : null}
                {selectedNode.kind === "knowledge_store" ? (
                  <Field label="Векторное хранилище">
                    <Select
                      value={String(selectedNode.config?.vectorStoreId ?? "")}
                      onChange={(vectorStoreId) =>
                        updateSelectedNode({
                          config: {
                            ...selectedNode.config,
                            vectorStoreId: Number(vectorStoreId),
                          },
                          description:
                            vectorStoreStore.stores.find(
                              (item) => item.id === Number(vectorStoreId),
                            )?.name ?? selectedNode.description,
                        })
                      }
                      options={vectorStoreStore.stores
                        .filter((item) => item.status === "ready")
                        .map((item) => ({
                          value: String(item.id),
                          label: item.name,
                        }))}
                      placeholder="Выберите хранилище"
                      searchable
                    >
                      <Select.Trigger className="w-full" />
                      <Select.Menu>
                        {vectorStoreStore.stores
                          .filter((item) => item.status === "ready")
                          .map((item) => (
                            <Select.Option
                              key={item.id}
                              value={String(item.id)}
                              label={item.name}
                            />
                          ))}
                      </Select.Menu>
                    </Select>
                  </Field>
                ) : null}
                <div className="rounded-lg bg-main-800/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-main-300">
                    <ClockIcon className="size-3.5" />
                    Ограничение выполнения
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-main-500">
                    Таймаут 60 секунд · 2 повторные попытки
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid h-48 place-items-center px-6 text-center text-sm text-main-500">
                Выберите узел на графе
              </div>
            )}
            {automationStore.activeScenarioRun ? (
              <div className="m-4 rounded-lg bg-main-800/55 p-3 text-xs text-main-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    Запуск #{automationStore.activeScenarioRun.id}
                  </span>
                  <span className="text-main-500">
                    {automationStore.activeScenarioRun.status}
                  </span>
                </div>
                <p className="mt-2 text-main-500">
                  Выполнено узлов:{" "}
                  {
                    automationStore.scenarioNodeRuns.filter(
                      (item) => item.status === "completed",
                    ).length
                  }
                </p>
              </div>
            ) : null}
          </aside>
        </div>
        {automationStore.pendingScenarioApproval ? (
          <DangerModal
            model={automationStore.pendingScenarioApproval}
            title="Продолжить сценарий?"
            description={(approval) => approval.prompt}
            confirmLabel="Продолжить"
            onCancel={() => void automationStore.approveScenarioRun(false)}
            onConfirm={() => automationStore.approveScenarioRun(true)}
          />
        ) : null}
      </section>
    );
  },
);
