import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { PersonNode } from "./PersonNode";
import { buildTree } from "@/lib/tree-layout";
import type { Person, Relationship } from "@/lib/family-data";

const nodeTypes = { person: PersonNode };

export function FamilyTree({
  persons,
  relationships,
  onSelect,
  onOpen,
  highlightId,
  relatedIds,
}: {
  persons: Person[];
  relationships: Relationship[];
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  highlightId?: string | null;
  relatedIds?: Set<string>;
}) {
  const { nodes, edges } = useMemo(
    () => buildTree(persons, relationships),
    [persons, relationships],
  );

  const styledNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => {
        if (n.id === highlightId) {
          return {
            ...n,
            style: { ...n.style, outline: "3px solid hsl(45 95% 55%)", borderRadius: 12 },
          };
        }
        if (relatedIds?.has(n.id)) {
          return {
            ...n,
            style: { ...n.style, outline: "2px solid hsl(160 70% 45%)", borderRadius: 12 },
          };
        }
        return n;
      }),
    [nodes, highlightId, relatedIds],
  );

  const [rfKey] = useState(() => Math.random());

  return (
    <ReactFlow
      key={rfKey}
      nodes={styledNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onNodeDoubleClick={(_, node) => onOpen?.(node.id)}
      fitView
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}