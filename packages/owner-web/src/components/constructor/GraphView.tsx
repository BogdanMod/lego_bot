'use client';

import { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import type { BotSchema } from '@/lib/templates/types';

interface GraphViewProps {
  schema: BotSchema;
  onNodeClick?: (stateName: string) => void;
  selectedState?: string | null;
}

const nodeWidth = 200;
const nodeHeight = 72;

function getLayoutedElements(
  schema: BotSchema,
  direction: 'TB' | 'LR' = 'TB'
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 56 });

  function nodeLabel(stateName: string, maxLen = 24): string {
    const msg = schema.states[stateName]?.message ?? '';
    const firstLine = msg.split('\n')[0].trim();
    if (!firstLine) return stateName;
    return firstLine.length <= maxLen ? firstLine : firstLine.slice(0, maxLen - 1) + '…';
  }

  const nodes: Node[] = Object.keys(schema.states).map((stateName) => ({
    id: stateName,
    type: 'default',
    data: {
      label: nodeLabel(stateName),
      isInitial: stateName === schema.initialState,
    },
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = [];
  Object.entries(schema.states).forEach(([stateName, state]) => {
    state.buttons?.forEach((button) => {
      edges.push({
        id: `${stateName}-${button.nextState}-${button.text}`,
        source: stateName,
        target: button.nextState,
        label: button.text || '→',
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: '#64748b',
          strokeWidth: 2,
        },
        labelStyle: {
          fill: '#475569',
          fontSize: 12,
          fontWeight: 500,
        },
        labelBgStyle: { fill: '#f1f5f9' },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
      });
    });
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      const isInitial = node.data.isInitial;
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
        style: {
          ...node.style,
          background: isInitial ? '#0f172a' : '#ffffff',
          color: isInitial ? '#ffffff' : '#0f172a',
          border: `2px solid ${isInitial ? '#0f172a' : '#e2e8f0'}`,
          borderRadius: '10px',
          fontWeight: isInitial ? 600 : 500,
          fontSize: '14px',
          padding: '14px 18px',
          minWidth: nodeWidth,
          minHeight: nodeHeight,
          boxShadow: isInitial
            ? '0 2px 8px rgba(15, 23, 42, 0.2)'
            : '0 1px 4px rgba(0, 0, 0, 0.08)',
        },
      };
    }),
    edges,
  };
}

export function GraphView({
  schema,
  onNodeClick,
  selectedState,
}: GraphViewProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(schema),
    [schema]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when schema changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = getLayoutedElements(schema);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [schema, setNodes, setEdges]);

  // Highlight selected node (толстая синяя рамка + тень)
  const nodesWithSelection = useMemo(() => {
    return nodes.map((node) => {
      const isSelected = node.id === selectedState;
      const isInitial = node.data.isInitial;
      return {
        ...node,
        selected: isSelected,
        style: {
          ...node.style,
          border: `2px solid ${
            isSelected ? '#2563eb' : isInitial ? '#0f172a' : '#e2e8f0'
          }`,
          boxShadow: isSelected
            ? '0 0 0 2px rgba(37, 99, 235, 0.3)'
            : isInitial
            ? '0 2px 8px rgba(15, 23, 42, 0.2)'
            : '0 1px 4px rgba(0, 0, 0, 0.08)',
        },
      };
    });
  }, [nodes, selectedState]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-950">
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.25}
        maxZoom={1.8}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        nodeTypes={{}}
        edgeTypes={{}}
        className="bg-slate-50 dark:bg-slate-950"
      >
        <Background 
          color="#e2e8f0" 
          gap={16} 
          size={1}
          className="dark:opacity-20"
        />
        <Controls
          showInteractive={false}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        />
        <MiniMap
          nodeColor={(node) =>
            node.data?.isInitial ? '#0f172a' : '#94a3b8'
          }
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        />
      </ReactFlow>
    </div>
  );
}

