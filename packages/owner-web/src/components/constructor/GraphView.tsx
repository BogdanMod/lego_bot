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

const nodeWidth = 180;
const nodeHeight = 60;

function getLayoutedElements(
  schema: BotSchema,
  direction: 'TB' | 'LR' = 'TB'
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  const nodes: Node[] = Object.keys(schema.states).map((stateName) => ({
    id: stateName,
    type: 'default',
    data: {
      label: stateName,
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
          stroke: '#94a3b8',
          strokeWidth: 1.5,
        },
        labelStyle: {
          fill: '#64748b',
          fontSize: 11,
        },
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
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - nodeHeight / 2,
        },
        style: {
          ...node.style,
          background: node.data.isInitial
            ? '#0f172a'
            : '#ffffff',
          color: node.data.isInitial ? '#ffffff' : '#0f172a',
          border: `1.5px solid ${node.data.isInitial ? '#0f172a' : '#e2e8f0'}`,
          borderRadius: '8px',
          fontWeight: node.data.isInitial ? 600 : 500,
          fontSize: '13px',
          padding: '12px 16px',
          boxShadow: node.data.isInitial
            ? '0 2px 8px rgba(15, 23, 42, 0.15)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
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

  // Highlight selected node
  const nodesWithSelection = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      selected: node.id === selectedState,
      style: {
        ...node.style,
        border: `1.5px solid ${
          node.id === selectedState
            ? '#3b82f6'
            : node.data.isInitial
            ? '#0f172a'
            : '#e2e8f0'
        }`,
      },
    }));
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
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
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

