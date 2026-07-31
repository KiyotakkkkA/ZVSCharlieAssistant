import {
  type PointerEvent as ReactPointerEvent,
  type SVGProps,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  InputBig,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useParams } from "react-router-dom";
import {
  ChatIcon,
  ChevronLeftIcon,
  ClockIcon,
  MoreIcon,
  PlusIcon,
  RobotIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  TasksIcon,
} from "../../../components/atoms";
import { AppBreadcrumbs } from "../../../components/molecules";
import { APP_PATHS } from "../../../app/routes";
import { useHashRouter } from "../../../hooks";
import { automationStore } from "../../../stores";

type NodeKind = "trigger" | "agent" | "condition" | "approval" | "output";

interface GraphNode {
  id: string;
  kind: NodeKind;
  title: string;
  description: string;
  x: number;
  y: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

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
  agent: {
    label: "Агент",
    color: "text-violet-200 bg-violet-400/10",
    dot: "bg-violet-300",
    icon: (props) => <RobotIcon {...props} />,
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
    kind: "agent",
    title: "Оркестратор",
    description: "Анализирует задачу",
    x: 330,
    y: 250,
  },
  {
    id: "researcher",
    kind: "agent",
    title: "Исследователь",
    description: "Собирает контекст",
    x: 590,
    y: 120,
  },
  {
    id: "computer-operator",
    kind: "agent",
    title: "Оператор компьютера",
    description: "Выполняет действие",
    x: 590,
    y: 380,
  },
  {
    id: "response",
    kind: "output",
    title: "Ответ пользователю",
    description: "Возвращает результат",
    x: 850,
    y: 250,
  },
];

const initialEdges: GraphEdge[] = [
  { id: "e1", source: "chat-trigger", target: "orchestrator" },
  { id: "e2", source: "orchestrator", target: "researcher" },
  { id: "e3", source: "orchestrator", target: "computer-operator" },
  { id: "e4", source: "researcher", target: "response" },
  { id: "e5", source: "computer-operator", target: "response" },
];

const palette: Array<{ kind: NodeKind; title: string; description: string }> = [
  { kind: "trigger", title: "Триггер", description: "Начало выполнения" },
  { kind: "agent", title: "Вызов агента", description: "Делегирование задачи" },
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

export function ScenarioGraphEditorPage() {
  const { goTo } = useHashRouter();
  const { scenarioId } = useParams();
  const scenario = automationStore.getScenario(scenarioId);
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState("orchestrator");
  const [zoom, setZoom] = useState(0.86);
  const [errorBehavior, setErrorBehavior] = useState("stop");
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  const edgePaths = useMemo(
    () =>
      initialEdges.flatMap((edge) => {
        const source = nodes.find((node) => node.id === edge.source);
        const target = nodes.find((node) => node.id === edge.target);
        if (!source || !target) return [];
        const x1 = source.x + 210;
        const y1 = source.y + 49;
        const x2 = target.x;
        const y2 = target.y + 49;
        const curve = Math.max(70, Math.abs(x2 - x1) * 0.45);
        return [
          {
            ...edge,
            path: `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
          },
        ];
      }),
    [nodes],
  );

  const startDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    node: GraphNode,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
    setSelectedNodeId(node.id);
  };

  const dragNode = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === drag.id
          ? {
              ...node,
              x: Math.max(
                20,
                drag.nodeX + (event.clientX - drag.startX) / zoom,
              ),
              y: Math.max(
                20,
                drag.nodeY + (event.clientY - drag.startY) / zoom,
              ),
            }
          : node,
      ),
    );
  };

  const addNode = (kind: NodeKind, title: string) => {
    const id = `${kind}-${Date.now()}`;
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
    const saved = await automationStore.upsertScenario({
      id: scenario?.id,
      name: scenario?.name ?? "Новый сценарий",
      description:
        scenario?.description ??
        "Новый сценарий автоматизации с вызовом агентов.",
      status: scenario?.status ?? "draft",
      nodesCount: nodes.length,
    });
    if (!scenarioId) {
      goTo(
        APP_PATHS.automation.scenarios.edit.replace(":scenarioId", saved.id),
        { replace: true },
      );
    }
  };

  return (
    <section className="-m-2 flex h-[calc(100%+1rem)] min-h-155 flex-col overflow-hidden bg-main-900">
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-main-100">
                {scenario?.name ?? "Новый сценарий"}
              </h1>
              <span className="rounded-full bg-warning-medium/10 px-2 py-0.5 text-[10px] text-warning-light">
                Черновик
              </span>
            </div>
            <p className="mt-0.5 text-xs text-main-500">
              Изменения сохранены локально
            </p>
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
            <Button variant="secondary" className="px-2">
              Проверить
            </Button>
            <Button variant="primary" className="px-2">
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
            Выберите узел для настройки. Перетаскивайте узлы по рабочей области.
          </div>
        </aside>

        <div className="relative min-w-0 flex-1 overflow-hidden bg-main-900">
          <div className="absolute inset-0 bg-main-900" />

          <div
            className="absolute left-0 top-0 h-180 w-290 origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              {edgePaths.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.path}
                    fill="none"
                    stroke="rgb(82 82 82)"
                    strokeWidth="3"
                  />
                  <path
                    d={edge.path}
                    fill="none"
                    stroke="rgb(183 243 74 / .45)"
                    strokeWidth="1.4"
                  />
                </g>
              ))}
            </svg>

            {nodes.map((node) => {
              const meta = nodeMeta[node.kind];
              const selected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  className={`absolute w-52.5 cursor-grab select-none rounded-xl bg-main-800/95 ring-1 transition-colors active:cursor-grabbing ${
                    selected
                      ? "ring-accent-medium/70"
                      : "ring-main-700 hover:ring-main-500"
                  }`}
                  style={{ left: node.x, top: node.y }}
                  onPointerDown={(event) => startDrag(event, node)}
                  onPointerMove={dragNode}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                >
                  <span
                    className={`absolute -left-1.5 top-10.75 size-3 rounded-full border-2 border-main-800 ${meta.dot}`}
                  />
                  <span
                    className={`absolute -right-1.5 top-10.75 size-3 rounded-full border-2 border-main-800 ${meta.dot}`}
                  />
                  <div className="flex items-center gap-3 border-b border-main-700/60 p-3">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg ${meta.color}`}
                    >
                      {meta.icon({ className: "size-4" })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-main-100">
                        {node.title}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-main-500">
                        {meta.label}
                      </p>
                    </div>
                    <MoreIcon className="size-4 text-main-600" />
                  </div>
                  <p className="truncate px-3 py-2.5 text-xs text-main-400">
                    {node.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="absolute bottom-4 left-4 flex items-center overflow-hidden rounded-lg bg-main-800/90 ring-1 ring-main-700">
            <button
              className="grid size-9 place-items-center text-main-300 hover:bg-main-700"
              onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}
            >
              −
            </button>
            <button
              className="h-9 min-w-14 border-x border-main-700 px-2 text-xs text-main-400 hover:bg-main-700"
              onClick={() => setZoom(0.86)}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="grid size-9 place-items-center text-main-300 hover:bg-main-700"
              onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}
            >
              +
            </button>
          </div>

          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-main-800/90 px-3 py-2 text-xs text-main-400 ring-1 ring-main-700">
            <span className="size-2 rounded-full bg-success-medium" />
            Граф корректен · {nodes.length} узлов
          </div>
        </div>

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

              <InspectorField label="Название">
                <InputSmall
                  value={selectedNode.title}
                  onChange={(event) =>
                    updateSelectedNode({ title: event.target.value })
                  }
                />
              </InspectorField>
              <InspectorField label="Описание">
                <InputBig
                  value={selectedNode.description}
                  onChange={(event) =>
                    updateSelectedNode({ description: event.target.value })
                  }
                  minRows={3}
                  maxRows={6}
                  autoResize
                />
              </InspectorField>
              <InspectorField label="Поведение при ошибке">
                <Select
                  value={errorBehavior}
                  onChange={setErrorBehavior}
                  options={[
                    { value: "stop", label: "Остановить выполнение" },
                    { value: "retry", label: "Повторить узел" },
                    { value: "continue", label: "Продолжить ветку" },
                  ]}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Menu>
                    <Select.Option value="stop" label="Остановить выполнение" />
                    <Select.Option value="retry" label="Повторить узел" />
                    <Select.Option value="continue" label="Продолжить ветку" />
                  </Select.Menu>
                </Select>
              </InspectorField>

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
        </aside>
      </div>
    </section>
  );
}

function InspectorField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-main-400">
        {label}
      </span>
      {children}
    </label>
  );
}
