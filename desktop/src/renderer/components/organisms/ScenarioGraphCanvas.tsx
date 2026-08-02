import { memo, useMemo, type SVGProps } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge as FlowEdge,
  type EdgeProps,
  type Node as FlowNode,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Dropdown } from "@kiyotakkkka/zvs-uikit-lib";
import {
  ChatIcon,
  MoreIcon,
  RobotIcon,
  SendIcon,
  SettingsIcon,
  TasksIcon,
  StorageIcon,
  TrashIcon,
} from "../atoms";
import type {
  AutomationScenarioEdge as GraphEdge,
  AutomationScenarioNode as GraphNode,
  AutomationScenarioNodeKind as NodeKind,
} from "../../../ipc/contracts";

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

export type ScenarioNodeData = {
  node: GraphNode;
  runStatus?: string;
  onDelete?: (nodeId: string) => void;
} & Record<string, unknown>;
export type ScenarioFlowNode = FlowNode<ScenarioNodeData, "scenario">;

export type ScenarioEdgeData = {
  edgeId: string;
  kind: GraphEdge["kind"];
  onDelete: (edgeId: string) => void;
} & Record<string, unknown>;
export type ScenarioFlowEdge = FlowEdge<ScenarioEdgeData, "scenario">;

type ScenarioGraphCanvasProps = {
  nodes: ScenarioFlowNode[];
  edges: ScenarioFlowEdge[];
  onNodesChange: OnNodesChange<ScenarioFlowNode>;
  onEdgesChange: OnEdgesChange<ScenarioFlowEdge>;
  onConnect: (connection: Connection) => void;
  onNodeSelect: (nodeId: string) => void;
};

export function ScenarioGraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
}: ScenarioGraphCanvasProps) {
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.node])),
    [nodes],
  );
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-main-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={scenarioNodeTypes}
        edgeTypes={scenarioEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={(connection) => {
          const source = connection.source
            ? nodesById.get(connection.source)
            : undefined;
          const target = connection.target
            ? nodesById.get(connection.target)
            : undefined;
          if (!source || !target || source.id === target.id) return false;
          const touchesKnowledgePort =
            connection.sourceHandle === "knowledge-out" ||
            connection.targetHandle === "knowledge-in";
          if (touchesKnowledgePort)
            return (
              connection.sourceHandle === "knowledge-out" &&
              connection.targetHandle === "knowledge-in" &&
              source.kind === "knowledge_store" &&
              target.kind === "agent"
            );
          const touchesWorkerPort =
            connection.sourceHandle === "workers" ||
            connection.targetHandle === "worker-in";
          if (touchesWorkerPort)
            return (
              connection.sourceHandle === "workers" &&
              connection.targetHandle === "worker-in" &&
              (source.kind === "orchestrator" || source.kind === "agent") &&
              target.kind === "agent"
            );
          return (
            connection.sourceHandle === "control-out" &&
            connection.targetHandle === "control-in" &&
            source.kind !== "agent" &&
            source.kind !== "output" &&
            source.kind !== "knowledge_store" &&
            target.kind !== "agent" &&
            target.kind !== "trigger" &&
            target.kind !== "knowledge_store"
          );
        }}
        onNodeClick={(_event, node) => onNodeSelect(node.id)}
        onInit={(instance) => {
          requestAnimationFrame(() => {
            void instance.fitView({ padding: 0.2, duration: 0 });
          });
        }}
        fitView
        minZoom={0.35}
        maxZoom={1.5}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-main-900"
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgb(55 55 55)" gap={24} size={1} />
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="overflow-hidden rounded-lg! border-0! bg-main-800! shadow-none! ring-1 ring-main-700"
        />
      </ReactFlow>
    </div>
  );
}

const ScenarioFlowEdgeView = memo(function ScenarioFlowEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<ScenarioFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={28}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <Dropdown menuWidth={180} menuPlacement="bottom-left">
            <Dropdown.Trigger
              icon={
                <span className="block size-2 rounded-full bg-accent-light transition-transform group-hover/edge:scale-125" />
              }
              aria-label="Настроить связь"
              rounded="rounded-full"
              className="nodrag nopan group/edge size-6 justify-center gap-0 border-0! bg-main-800/90 px-0 py-0 shadow-none ring-1 ring-main-600/70 transition-colors hover:bg-main-600 hover:ring-main-400"
            >
              <span className="sr-only">Настроить связь</span>
            </Dropdown.Trigger>
            <Dropdown.Menu rounded="rounded-xl" className="p-1.5">
              <Dropdown.Item
                icon={<TrashIcon className="size-4" />}
                className="rounded-lg text-danger-light"
                onClick={(event) => {
                  event.stopPropagation();
                  if (data) data.onDelete(data.edgeId);
                }}
              >
                Удалить связь
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

const ScenarioFlowNodeView = memo(function ScenarioFlowNodeView({
  data,
  selected,
}: NodeProps<ScenarioFlowNode>) {
  const node = data.node;
  const meta = nodeMeta[node.kind];
  return (
    <div
      className={`h-24.5 w-52.5 select-none rounded-xl bg-main-800/95 ring-1 transition-colors ${
        data.runStatus === "running" ||
        data.runStatus === "waiting_for_approval"
          ? "ring-accent-medium/90"
          : data.runStatus === "completed"
            ? "ring-success-medium/60"
            : data.runStatus === "failed"
              ? "ring-danger-medium/70"
              : selected
                ? "ring-accent-medium/80"
                : "ring-main-700 hover:ring-main-500"
      }`}
    >
      {node.kind === "agent" ? (
        <>
          <Handle
            id="worker-in"
            type="target"
            position={Position.Top}
            className={`size-3! border-2! border-main-800! ${meta.dot}`}
          />
          <Handle
            id="knowledge-in"
            type="target"
            position={Position.Left}
            className="size-3! border-2! border-main-800! bg-cyan-300"
          />
        </>
      ) : node.kind !== "trigger" && node.kind !== "knowledge_store" ? (
        <Handle
          id="control-in"
          type="target"
          position={Position.Left}
          className={`size-3! border-2! border-main-800! ${meta.dot}`}
        />
      ) : null}
      {node.kind === "orchestrator" ? (
        <>
          <Handle
            id="control-out"
            type="source"
            position={Position.Right}
            className={`size-3! border-2! border-main-800! ${meta.dot}`}
          />
          <Handle
            id="workers"
            type="source"
            position={Position.Bottom}
            className="size-3! border-2! border-main-800! bg-violet-300"
          />
        </>
      ) : node.kind === "agent" ? (
        <Handle
          id="workers"
          type="source"
          position={Position.Bottom}
          className="size-3! border-2! border-main-800! bg-violet-300"
        />
      ) : node.kind === "knowledge_store" ? (
        <Handle
          id="knowledge-out"
          type="source"
          position={Position.Right}
          className="size-3! border-2! border-main-800! bg-cyan-300"
        />
      ) : node.kind !== "output" ? (
        <Handle
          id="control-out"
          type="source"
          position={Position.Right}
          className={`size-3! border-2! border-main-800! ${meta.dot}`}
        />
      ) : null}
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
        {data.onDelete ? (
          <Dropdown menuWidth={170} menuPlacement="bottom-right">
            <Dropdown.Trigger
              icon={<MoreIcon className="size-4 text-main-500" />}
              aria-label="Настроить узел"
              rounded="rounded-lg"
              className="nodrag nopan size-7 justify-center gap-0 border-0! bg-transparent px-0 py-0 shadow-none ring-0! hover:bg-main-600/70"
            >
              <span className="sr-only">Настроить узел</span>
            </Dropdown.Trigger>
            <Dropdown.Menu rounded="rounded-xl" className="p-1.5">
              <Dropdown.Item
                icon={<TrashIcon className="size-4" />}
                className="rounded-lg text-danger-light"
                onClick={(event) => {
                  event.stopPropagation();
                  data.onDelete?.(node.id);
                }}
              >
                Удалить узел
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <MoreIcon className="size-4 text-main-700" />
        )}
      </div>
      <p className="truncate px-3 py-2.5 text-xs text-main-400">
        {node.description}
      </p>
    </div>
  );
}, areScenarioNodePropsEqual);

function areScenarioNodePropsEqual(
  previous: NodeProps<ScenarioFlowNode>,
  next: NodeProps<ScenarioFlowNode>,
) {
  return (
    previous.id === next.id &&
    previous.selected === next.selected &&
    previous.dragging === next.dragging &&
    previous.data.node === next.data.node &&
    previous.data.runStatus === next.data.runStatus
  );
}

const scenarioNodeTypes = { scenario: ScenarioFlowNodeView };
const scenarioEdgeTypes = { scenario: ScenarioFlowEdgeView };
