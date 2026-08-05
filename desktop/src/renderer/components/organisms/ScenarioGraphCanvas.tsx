import { memo, useMemo } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Panel,
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
import { Dropdown, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
import { TrashIcon } from "../atoms";
import { ScenarioNodeCard, scenarioNodeVariants } from "../molecules";
import type {
  AutomationScenarioEdge as GraphEdge,
  AutomationScenarioNode as GraphNode,
} from "../../../shared/dto";
import {
  SCENARIO_PORTS,
  isScenarioConnectionValid,
  type ScenarioPortDefinition,
} from "../../../shared/scenario-ports";

type ScenarioNodeData = {
  node: GraphNode;
  showDescription: boolean;
  runStatus?: string;
  onDelete?: (nodeId: string) => void;
} & Record<string, unknown>;
export type ScenarioFlowNode = FlowNode<ScenarioNodeData, "scenario">;

type ScenarioEdgeData = {
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
  const nodeKinds = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.node.kind])),
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
        isValidConnection={(connection) =>
          isScenarioConnectionValid(connection, nodeKinds)
        }
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
        <Panel position="bottom-center">
          <div className="flex items-center gap-3 rounded-md bg-main-800/90 px-2.5 py-1.5 text-[10px] text-main-500 ring-1 ring-main-700/80">
            <PortLegend
              shape="size-2.5 rounded-full bg-lime-300"
              label="Управление"
            />
            <PortLegend
              shape="h-2.5 w-4 rounded bg-violet-300"
              label="Исполнители"
            />
            <PortLegend
              shape="size-2.5 rounded-[2px] bg-cyan-300"
              label="Хранилище"
            />
          </div>
        </Panel>
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
            transform: `translate(-50%, -67%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <Dropdown menuWidth={180} menuPlacement="bottom-left">
            <Dropdown.Trigger
              icon={
                <span
                  className={`block size-1.5 rounded-full ${edgeDotClasses[data?.kind ?? "control"]}`}
                />
              }
              aria-label="Настроить связь"
              rounded="rounded-full"
              className="nodrag nopan size-4 justify-center gap-0 border-0! bg-main-900/90 px-0 py-0 shadow-none ring-1 ring-main-700/80 transition-colors hover:bg-main-700"
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
  return (
    <ScenarioNodeCard
      node={node}
      variant={scenarioNodeVariants[node.kind]}
      selected={selected}
      showDescription={data.showDescription}
      runStatus={data.runStatus}
      onDelete={data.onDelete}
    >
      {node.kind === "agent" ? (
        <>
          <ScenarioPort port={SCENARIO_PORTS.workerIn} />
          <ScenarioPort port={SCENARIO_PORTS.knowledgeIn} />
        </>
      ) : node.kind !== "trigger" && node.kind !== "knowledge_store" ? (
        <ScenarioPort port={SCENARIO_PORTS.controlIn} />
      ) : null}
      {node.kind === "orchestrator" ? (
        <>
          <ScenarioPort port={SCENARIO_PORTS.controlOut} />
          <ScenarioPort port={SCENARIO_PORTS.workerOut} />
        </>
      ) : node.kind === "agent" ? (
        <ScenarioPort port={SCENARIO_PORTS.workerOut} />
      ) : node.kind === "knowledge_store" ? (
        <ScenarioPort port={SCENARIO_PORTS.knowledgeOut} />
      ) : node.kind !== "output" ? (
        <ScenarioPort port={SCENARIO_PORTS.controlOut} />
      ) : null}
    </ScenarioNodeCard>
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
    previous.data.showDescription === next.data.showDescription &&
    previous.data.runStatus === next.data.runStatus
  );
}

const scenarioNodeTypes = { scenario: ScenarioFlowNodeView };
const scenarioEdgeTypes = { scenario: ScenarioFlowEdgeView };

const edgeDotClasses: Record<GraphEdge["kind"], string> = {
  control: "bg-lime-300",
  worker: "bg-violet-300",
  knowledge: "bg-cyan-300",
};

const portPositions = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const;

const portClasses: Record<ScenarioPortDefinition["kind"], string> = {
  "control-input": "size-2.5! rounded-full! bg-lime-300! ring-2 ring-main-900",
  "control-output": "size-2.5! rounded-full! bg-lime-300! ring-2 ring-main-900",
  "worker-input": "h-2! w-3.5! rounded-sm! bg-violet-300! ring-2 ring-main-900",
  "worker-output":
    "h-2! w-3.5! rounded-sm! bg-violet-300! ring-2 ring-main-900",
  "knowledge-input":
    "size-2.5! rounded-none! bg-cyan-300! ring-2 ring-main-900",
  "knowledge-output":
    "size-2.5! rounded-none! bg-cyan-300! ring-2 ring-main-900",
};

function ScenarioPort({ port }: { port: ScenarioPortDefinition }) {
  return (
    <Handle
      id={port.id}
      type={port.direction}
      position={portPositions[port.side]}
      aria-label={port.label}
      className={`border-2! border-main-800! ${portClasses[port.kind]}`}
    >
      <span className="block size-full" />
    </Handle>
  );
}

function PortLegend({ shape, label }: { shape: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`block shrink-0 ${shape}`} />
      {label}
    </span>
  );
}
