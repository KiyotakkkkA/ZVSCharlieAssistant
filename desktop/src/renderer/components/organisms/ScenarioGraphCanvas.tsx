import { memo, useCallback, useMemo } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
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
import type { ScenarioNode } from "../../../shared/scenario/graph";
import { scenarioDescriptors } from "../../../shared/scenario/descriptors";
import {
  resolvePorts,
  type PortSpec,
} from "../../../shared/scenario/node-descriptor";
import {
  CATEGORY_ACCENT_VARS,
  ScenarioNodeCard,
  nodeVisual,
} from "../molecules/nodes";
import { readCssColor, useThemeMode } from "../../hooks";

type ScenarioNodeData = {
  node: ScenarioNode;
  showDescription: boolean;
  runStatus?: string;
  issue?: "error" | "warning";
  onDelete?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
} & Record<string, unknown>;
export type ScenarioFlowNode = FlowNode<ScenarioNodeData, "scenario">;

type ScenarioEdgeData = {
  edgeId: string;
  dataKind: "main" | "knowledge";
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
  onDrop?: (kind: string, position: { x: number; y: number }) => void;
};

function portsOf(node: ScenarioNode): {
  inputs: PortSpec[];
  outputs: PortSpec[];
} {
  const descriptor = scenarioDescriptors.get(node.kind);
  if (!descriptor) return { inputs: [], outputs: [] };
  const config = (node.config ?? {}) as Record<string, unknown>;
  return {
    inputs: resolvePorts(descriptor.inputs, config),
    outputs: resolvePorts(descriptor.outputs, config),
  };
}

export function ScenarioGraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeSelect,
  onDrop,
}: ScenarioGraphCanvasProps) {
  const nodesById = useMemo(
    () => new Map(nodes.map((item) => [item.id, item.data.node])),
    [nodes],
  );

  const isValidConnection = useCallback(
    (connection: Connection | FlowEdge) => {
      const source = nodesById.get(connection.source ?? "");
      const target = nodesById.get(connection.target ?? "");
      if (!source || !target || source.id === target.id) return false;
      const sourcePort = portsOf(source).outputs.find(
        (port) => port.id === connection.sourceHandle,
      );
      const targetPort = portsOf(target).inputs.find(
        (port) => port.id === connection.targetHandle,
      );
      if (!sourcePort || !targetPort) return false;
      if (sourcePort.dataKind !== targetPort.dataKind) return false;
      if (!targetPort.multiple) {
        const taken = edges.some(
          (edge) =>
            edge.target === connection.target &&
            edge.targetHandle === connection.targetHandle,
        );
        if (taken) return false;
      }
      return true;
    },
    [edges, nodesById],
  );

  const themeMode = useThemeMode();
  const canvasColors = useMemo(
    () => ({
      dots: readCssColor("--canvas-dots"),
      mask: readCssColor("--canvas-mask"),
      categories: Object.fromEntries(
        Object.entries(CATEGORY_ACCENT_VARS).map(([category, variable]) => [
          category,
          readCssColor(variable),
        ]),
      ) as Record<string, string>,
    }),
    [themeMode],
  );

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden bg-main-900"
      onDragOver={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={scenarioNodeTypes}
        edgeTypes={scenarioEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_event, node) => onNodeSelect(node.id)}
        onDrop={(event) => {
          if (!onDrop) return;
          event.preventDefault();
          const kind = event.dataTransfer.getData("application/scenario-node");
          if (!kind) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          onDrop(kind, {
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          });
        }}
        onInit={(instance) => {
          requestAnimationFrame(() => {
            void instance.fitView({ padding: 0.2, duration: 0 });
          });
        }}
        fitView
        minZoom={0.2}
        maxZoom={1.6}
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode={themeMode}
        proOptions={{ hideAttribution: true }}
      >
        <Background color={canvasColors.dots} gap={24} size={1} />
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="overflow-hidden rounded-lg! shadow-none! ring-1 ring-main-700"
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="rounded-lg! bg-main-800! ring-1 ring-main-700"
          maskColor={canvasColors.mask}
          nodeColor={(node) => {
            const data = node.data as ScenarioNodeData | undefined;
            const category = data?.node
              ? nodeVisual(data.node.kind).category
              : "data";
            return canvasColors.categories[category] ?? "currentColor";
          }}
        />
        <Panel position="top-right">
          <div className="flex items-center gap-3 rounded-md bg-main-800/90 px-2.5 py-1.5 text-[10px] text-main-500 ring-1 ring-main-700/80">
            <PortLegend
              shape="size-2.5 rounded-full bg-[var(--port-main)]"
              label="Данные"
            />
            <PortLegend
              shape="size-2.5 rounded-[2px] bg-[var(--port-knowledge)]"
              label="База знаний"
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
                  className={`block size-1.5 rounded-full ${
                    data?.dataKind === "knowledge"
                      ? "bg-(--port-knowledge)"
                      : "bg-(--port-main)"
                  }`}
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
  const { inputs, outputs } = portsOf(node);
  return (
    <ScenarioNodeCard
      node={node}
      selected={selected}
      showDescription={data.showDescription}
      runStatus={data.runStatus}
      issue={data.issue}
      onDelete={data.onDelete}
      onToggleDisabled={data.onToggleDisabled}
    >
      {inputs.map((port, index) => (
        <ScenarioPort
          key={`in-${port.id}`}
          port={port}
          direction="target"
          index={index}
          total={inputs.length}
        />
      ))}
      {outputs.map((port, index) => (
        <ScenarioPort
          key={`out-${port.id}`}
          port={port}
          direction="source"
          index={index}
          total={outputs.length}
        />
      ))}
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
    previous.data.issue === next.data.issue &&
    previous.data.showDescription === next.data.showDescription &&
    previous.data.runStatus === next.data.runStatus
  );
}

const scenarioNodeTypes = { scenario: ScenarioFlowNodeView };
const scenarioEdgeTypes = { scenario: ScenarioFlowEdgeView };

const portPositions = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const;

function ScenarioPort({
  port,
  direction,
  index,
  total,
}: {
  port: PortSpec;
  direction: "source" | "target";
  index: number;
  total: number;
}) {
  const sameSide = port.side === "left" || port.side === "right";
  const offset = total <= 1 ? 50 : ((index + 1) / (total + 1)) * 100;
  const style = sameSide ? { top: `${offset}%` } : { left: `${offset}%` };
  const shape =
    port.dataKind === "knowledge"
      ? "size-2.5! rounded-[2px]! bg-[var(--port-knowledge)]!"
      : "size-2.5! rounded-full! bg-[var(--port-main)]!";
  return (
    <Handle
      id={port.id}
      type={direction}
      position={portPositions[port.side]}
      title={port.label}
      aria-label={port.label}
      style={style}
      className={`z-20! border-2! border-main-800! ring-2 ring-main-900 ${shape} ${port.optional ? "opacity-70" : ""}`}
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
