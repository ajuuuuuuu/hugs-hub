import dagre from "dagre";
import type { Edge, Node } from "reactflow";
import type { Person, Relationship } from "./family-data";

const W = 160;
const H = 100;
const SPOUSE_GAP = 30; // horizontal gap between spouse cards
const MIN_GAP = 30; // minimum gap between unrelated cards on a row
const SLOT = W + SPOUSE_GAP;

export function buildTree(
  persons: Person[],
  relationships: Relationship[],
): { nodes: Node[]; edges: Edge[] } {
  const personIds = new Set(persons.map((p) => p.id));
  const byId = new Map(persons.map((p) => [p.id, p]));
  const rels = relationships.filter(
    (r) => personIds.has(r.person1Id) && personIds.has(r.person2Id),
  );
  const parentRels = rels
    .filter((r) => r.type === "parent")
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const spouseRels = rels
    .filter((r) => r.type === "spouse")
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const parentsOf = new Map<string, string[]>();
  parentRels.forEach((r) => {
    const arr = parentsOf.get(r.person2Id) ?? [];
    arr.push(r.person1Id);
    parentsOf.set(r.person2Id, arr);
  });
  const hasParents = (id: string) => (parentsOf.get(id)?.length ?? 0) > 0;

  // Ordered spouses per person (spouse rel sortOrder = marriage order).
  const spousesOf = new Map<string, string[]>();
  spouseRels.forEach((r) => {
    const a = spousesOf.get(r.person1Id) ?? [];
    a.push(r.person2Id);
    spousesOf.set(r.person1Id, a);
    const b = spousesOf.get(r.person2Id) ?? [];
    b.push(r.person1Id);
    spousesOf.set(r.person2Id, b);
  });

  // Chains: an anchor (partner rooted in the tree) plus orphan spouses.
  // First spouse sits LEFT of the anchor, second and later sit RIGHT.
  const chains = new Map<string, string[]>();
  const orphanToAnchor = new Map<string, string>();
  spouseRels.forEach((r) => {
    let anchor = r.person1Id;
    let other = r.person2Id;
    if (hasParents(r.person2Id) && !hasParents(r.person1Id)) {
      anchor = r.person2Id;
      other = r.person1Id;
    }
    if (hasParents(other)) return; // spouse has own parents in tree; dagre places them
    if (orphanToAnchor.has(other)) return;
    const arr = chains.get(anchor) ?? [];
    arr.push(other);
    chains.set(anchor, arr);
    orphanToAnchor.set(other, anchor);
  });
  const offsetOf = (idx: number) => (idx === 0 ? -1 : idx);

  // Which union does a child belong to?
  // 0 = first wife (left), 1 = mother not recorded (middle), i+1 = i-th wife (right).
  const groupKeyOf = (parentId: string, childId: string): number => {
    const spouses = spousesOf.get(parentId) ?? [];
    if (spouses.length === 0) return 1;
    const others = (parentsOf.get(childId) ?? []).filter((p) => p !== parentId);
    let idx = -1;
    others.forEach((o) => {
      const i = spouses.indexOf(o);
      if (i >= 0 && (idx === -1 || i < idx)) idx = i;
    });
    if (idx === -1) return 1;
    return idx === 0 ? 0 : idx + 1;
  };

  // Children per parent, ordered by (union group, sortOrder).
  const childRelsOf = new Map<string, Relationship[]>();
  parentRels.forEach((r) => {
    const arr = childRelsOf.get(r.person1Id) ?? [];
    arr.push(r);
    childRelsOf.set(r.person1Id, arr);
  });
  childRelsOf.forEach((arr, pid) => {
    arr.sort(
      (a, b) =>
        groupKeyOf(pid, a.person2Id) - groupKeyOf(pid, b.person2Id) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  });

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));
  persons.forEach((p) => g.setNode(p.id, { width: W, height: H }));

  const edges: Edge[] = [];
  childRelsOf.forEach((arr) => {
    arr.forEach((r) => {
      g.setEdge(r.person1Id, r.person2Id);
      const isMotherEdge = byId.get(r.person1Id)?.gender === "female";
      edges.push({
        id: r.id,
        source: r.person1Id,
        target: r.person2Id,
        type: "smoothstep",
        style: isMotherEdge
          ? { stroke: "hsl(340 70% 55%)", strokeWidth: 1.5 }
          : { stroke: "hsl(220 60% 50%)", strokeWidth: 2 },
      });
    });
  });

  // Invisible ranking edges keep orphan spouses on the same rank as partner.
  chains.forEach((orphans, anchor) => {
    const pa = parentsOf.get(anchor) ?? [];
    orphans.forEach((o) => {
      pa.forEach((p) => g.setEdge(p, o, { weight: 0, minlen: 1 }));
    });
  });

  dagre.layout(g);

  const pos = new Map<string, { x: number; y: number }>();
  persons.forEach((p) => {
    const n = g.node(p.id);
    pos.set(p.id, { x: n?.x ?? 0, y: n?.y ?? 0 });
  });

  // Pass 1: enforce per-union child order left→right by reassigning x slots.
  childRelsOf.forEach((arr, pid) => {
    if (orphanToAnchor.has(pid)) return; // mother edges follow the father's ordering
    if (arr.length < 2) return;
    const kids = arr.map((r) => r.person2Id);
    const slots = kids
      .map((k) => pos.get(k)!.x)
      .slice()
      .sort((a, b) => a - b);
    kids.forEach((k, i) => {
      pos.get(k)!.x = slots[i];
    });
  });

  // Pass 2: snap orphan spouses next to their anchor (1st left, 2nd+ right).
  chains.forEach((orphans, anchor) => {
    const ap = pos.get(anchor)!;
    orphans.forEach((o, i) => {
      const op = pos.get(o)!;
      op.x = ap.x + offsetOf(i) * SLOT;
      op.y = ap.y;
    });
  });

  // Pass 3: resolve horizontal overlaps per row, moving couple chains as blocks.
  const blockOf = (id: string) => orphanToAnchor.get(id) ?? id;
  const rowMap = new Map<number, string[]>();
  persons.forEach((p) => {
    const y = Math.round(pos.get(p.id)!.y);
    const arr = rowMap.get(y) ?? [];
    arr.push(p.id);
    rowMap.set(y, arr);
  });
  rowMap.forEach((ids) => {
    const blocks = new Map<string, string[]>();
    ids.forEach((id) => {
      const b = blockOf(id);
      const arr = blocks.get(b) ?? [];
      arr.push(id);
      blocks.set(b, arr);
    });
    const list = Array.from(blocks.values()).map((members) => {
      const xs = members.map((m) => pos.get(m)!.x);
      return {
        members,
        left: Math.min(...xs) - W / 2,
        right: Math.max(...xs) + W / 2,
      };
    });
    list.sort((a, b) => a.left - b.left);
    let cursor = Number.NEGATIVE_INFINITY;
    list.forEach((blk) => {
      const shift =
        cursor === Number.NEGATIVE_INFINITY ? 0 : Math.max(0, cursor - blk.left);
      if (shift > 0) blk.members.forEach((m) => (pos.get(m)!.x += shift));
      cursor = blk.right + shift + MIN_GAP;
    });
  });

  const nodes: Node[] = persons.map((p) => {
    const { x, y } = pos.get(p.id)!;
    return {
      id: p.id,
      type: "person",
      position: { x: x - W / 2, y: y - H / 2 },
      data: { person: p },
    };
  });

  // Spouse edges drawn between the adjacent sides based on final positions.
  spouseRels.forEach((r) => {
    const p1 = pos.get(r.person1Id)!;
    const p2 = pos.get(r.person2Id)!;
    const [src, tgt] =
      p1.x <= p2.x ? [r.person1Id, r.person2Id] : [r.person2Id, r.person1Id];
    edges.push({
      id: r.id,
      source: src,
      target: tgt,
      type: "straight",
      animated: false,
      style: { stroke: "hsl(340 70% 55%)", strokeWidth: 2, strokeDasharray: "6 4" },
      sourceHandle: "right",
      targetHandle: "left",
    });
  });

  return { nodes, edges };
}

export function getYear(date?: string): string {
  if (!date) return "";
  return date.slice(0, 4);
}
