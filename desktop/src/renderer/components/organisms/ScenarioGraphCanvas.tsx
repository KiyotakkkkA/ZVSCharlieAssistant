import { memo, useMemo, type CSSProperties } from "react";
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
import { Dropdown } from "@kiyotakkkka/zvs-uikit-lib";
import { TrashIcon } from "../atoms";
import type {
  AutomationScenarioEdge as GraphEdge,
  AutomationScenarioNode as GraphNode,
} from "../../../shared/dto";
import {
  SCENARIO_PORTS,
  isScenarioConnectionValid,
  type ScenarioPortDefinition,
} from "../../../shared/scenario-ports";
import {
  ScenarioNodeCard,
  ScenarioTriggerNodeSummary,
  scenarioNodeVariants,
} from "../molecules/nodes";

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
              label="Текст"
            />
            <PortLegend
              shape="h-2.5 w-4 rounded bg-violet-300"
              label="Исполнители"
            />
            <PortLegend
              shape="size-2.5 rounded-[2px] bg-cyan-300"
              label="Хранилище"
            />
            <PortLegend
              shape="size-2.5 rounded-full bg-pink-300"
              label="Файлы"
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
                  className={`block size-1.5 rounded-full ${edgeDotClasses[data?.kind ?? "text"]}`}
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
      {node.kind === "orchestrator" ? (
        <ScenarioPort port={SCENARIO_PORTS.textIn} />
      ) : node.kind === "agent" ? (
        <>
          <ScenarioPort port={SCENARIO_PORTS.workerIn} />
          <ScenarioPort port={SCENARIO_PORTS.knowledgeIn} />
        </>
      ) : node.kind === "download_files" || node.kind === "read_files" ? (
        <ScenarioPort port={SCENARIO_PORTS.filesIn} />
      ) : node.kind !== "trigger" && node.kind !== "knowledge_store" ? (
        <ScenarioPort port={SCENARIO_PORTS.textIn} />
      ) : null}
      {node.kind === "trigger" ? (
        <ScenarioTriggerNodeSummary
          node={node}
          renderPort={(channel) => (
            <>
              <ScenarioPort
                key={channel.portId}
                port={
                  channel.portId === SCENARIO_PORTS.telegramMessageOut.id
                    ? SCENARIO_PORTS.telegramMessageOut
                    : SCENARIO_PORTS.emailMessageOut
                }
                style={{ right: -5, top: "25%" }}
              />
              <ScenarioPort
                key={`${channel.portId}-attachments`}
                port={
                  channel.portId === SCENARIO_PORTS.telegramMessageOut.id
                    ? SCENARIO_PORTS.telegramAttachmentsOut
                    : SCENARIO_PORTS.emailAttachmentsOut
                }
                style={{ right: -5, top: "75%" }}
              />
            </>
          )}
        />
      ) : null}
      {node.kind === "orchestrator" ? (
        <>
          <ScenarioPort port={SCENARIO_PORTS.textOut} />
          <ScenarioPort port={SCENARIO_PORTS.workerOut} />
        </>
      ) : node.kind === "agent" ? (
        <ScenarioPort port={SCENARIO_PORTS.workerOut} />
      ) : node.kind === "knowledge_store" ? (
        <ScenarioPort port={SCENARIO_PORTS.knowledgeOut} />
      ) : node.kind === "download_files" ? (
        <ScenarioPort port={SCENARIO_PORTS.filesOut} />
      ) : node.kind === "read_files" ? (
        <ScenarioPort port={SCENARIO_PORTS.textOut} />
      ) : node.kind === "trigger" ? (
        <>
          <ScenarioPort
            port={SCENARIO_PORTS.textOut}
            style={{ right: -5, top: 22 }}
          />
          <ScenarioPort
            port={SCENARIO_PORTS.chatAttachmentsOut}
            style={{ right: -5, top: 40 }}
          />
        </>
      ) : node.kind !== "output" ? (
        <ScenarioPort port={SCENARIO_PORTS.textOut} />
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
  text: "bg-lime-300",
  worker: "bg-violet-300",
  knowledge: "bg-cyan-300",
  files: "bg-pink-300",
};

const portPositions = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const;

const portClasses: Record<ScenarioPortDefinition["kind"], string> = {
  "text-input": "size-2.5! rounded-full! bg-lime-300! ring-2 ring-main-900",
  "text-output": "size-2.5! rounded-full! bg-lime-300! ring-2 ring-main-900",
  "event-output": "size-2.5! rounded-full! bg-lime-300! ring-2 ring-main-900",
  "worker-input": "h-2! w-3.5! rounded-sm! bg-violet-300! ring-2 ring-main-900",
  "worker-output":
    "h-2! w-3.5! rounded-sm! bg-violet-300! ring-2 ring-main-900",
  "knowledge-input":
    "size-2.5! rounded-none! bg-cyan-300! ring-2 ring-main-900",
  "knowledge-output":
    "size-2.5! rounded-none! bg-cyan-300! ring-2 ring-main-900",
  "files-input": "size-2.5! rounded-full! bg-pink-300! ring-2 ring-main-900",
  "files-output": "size-2.5! rounded-full! bg-pink-300! ring-2 ring-main-900",
};

function ScenarioPort({
  port,
  style,
}: {
  port: ScenarioPortDefinition;
  style?: CSSProperties;
}) {
  return (
    <Handle
      id={port.id}
      type={port.direction}
      position={portPositions[port.side]}
      aria-label={port.label}
      style={style}
      className={`z-20! border-2! border-main-800! ${portClasses[port.kind]}`}
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
