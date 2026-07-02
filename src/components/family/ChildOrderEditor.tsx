import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Person, Relationship } from "@/lib/family-data";
import { setChildMother, updateChildOrder } from "@/lib/family-api";
import { toast } from "sonner";

interface Row {
  relId: string;
  child: Person;
  motherId: string | null;
}

interface GroupDef {
  key: string;
  label: string;
  motherId: string | null;
}

const NONE = "__none__";

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function ChildOrderEditor({
  persons,
  relationships,
  onSaved,
}: {
  persons: Person[];
  relationships: Relationship[];
  onSaved: () => void;
}) {
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const parents = useMemo(() => {
    const ids = new Set(
      relationships.filter((r) => r.type === "parent").map((r) => r.person1Id),
    );
    return persons.filter((p) => ids.has(p.id));
  }, [persons, relationships]);

  const [parentId, setParentId] = useState<string>("");

  useEffect(() => {
    if (!parentId && parents[0]) setParentId(parents[0].id);
  }, [parents, parentId]);

  // Spouse relationships of the selected parent, in marriage order.
  const spouseRels = useMemo(
    () =>
      relationships
        .filter(
          (r) =>
            r.type === "spouse" &&
            (r.person1Id === parentId || r.person2Id === parentId),
        )
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [relationships, parentId],
  );
  const wives = useMemo(
    () =>
      spouseRels
        .map((r) => (r.person1Id === parentId ? r.person2Id : r.person1Id))
        .filter((id) => personById.has(id)),
    [spouseRels, parentId, personById],
  );

  // Display order matches the tree: 1st wife (left), unassigned (middle), 2nd+ (right).
  const groupDefs = useMemo<GroupDef[]>(() => {
    if (wives.length === 0) return [{ key: NONE, label: "Children", motherId: null }];
    const defs: GroupDef[] = [
      {
        key: wives[0],
        label: `With ${personById.get(wives[0])?.name ?? "?"} (1st wife — left)`,
        motherId: wives[0],
      },
      { key: NONE, label: "Mother not set (middle)", motherId: null },
    ];
    wives.slice(1).forEach((w, i) => {
      defs.push({
        key: w,
        label: `With ${personById.get(w)?.name ?? "?"} (${ordinal(i + 2)} wife — right)`,
        motherId: w,
      });
    });
    return defs;
  }, [wives, personById]);

  const initialGroups = useMemo<Record<string, Row[]>>(() => {
    const map: Record<string, Row[]> = {};
    groupDefs.forEach((d) => (map[d.key] = []));
    if (!parentId) return map;
    const childRels = relationships
      .filter((r) => r.type === "parent" && r.person1Id === parentId)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    childRels.forEach((r) => {
      const child = personById.get(r.person2Id);
      if (!child) return;
      const otherParents = relationships
        .filter(
          (x) =>
            x.type === "parent" &&
            x.person2Id === r.person2Id &&
            x.person1Id !== parentId,
        )
        .map((x) => x.person1Id);
      const motherId = wives.find((w) => otherParents.includes(w)) ?? null;
      const key = motherId ?? NONE;
      (map[key] ?? map[NONE]).push({ relId: r.id, child, motherId });
    });
    return map;
  }, [parentId, personById, relationships, wives, groupDefs]);

  const [groups, setGroups] = useState<Record<string, Row[]>>(initialGroups);
  useEffect(() => setGroups(initialGroups), [initialGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalChildren = Object.values(groups).reduce((n, arr) => n + arr.length, 0);

  function handleDragEnd(groupKey: string) {
    return (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setGroups((prev) => {
        const items = prev[groupKey] ?? [];
        const oldIndex = items.findIndex((r) => r.relId === active.id);
        const newIndex = items.findIndex((r) => r.relId === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, [groupKey]: arrayMove(items, oldIndex, newIndex) };
      });
    };
  }

  async function save() {
    try {
      const ordered = groupDefs.flatMap((d) => (groups[d.key] ?? []).map((r) => r.relId));
      await updateChildOrder(ordered);
      toast.success("Order saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function moveWife(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= spouseRels.length) return;
    const next = spouseRels.slice();
    [next[index], next[j]] = [next[j], next[index]];
    try {
      await updateChildOrder(next.map((r) => r.id));
      toast.success("Wife order updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function assignMother(row: Row, motherId: string | null) {
    try {
      await setChildMother(row.child.id, motherId, wives);
      toast.success(motherId ? "Mother assigned" : "Mother cleared");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (parents.length === 0) {
    return (
      <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        No parents with children yet.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Parent</span>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {parents.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={save} disabled={totalChildren < 2}>
          Save children order
        </Button>
      </div>

      {wives.length >= 2 && (
        <div className="space-y-1 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Wife order — 1st shows on the left of the husband, 2nd on the right
          </p>
          <ul className="space-y-1">
            {wives.map((w, i) => (
              <li
                key={w}
                className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-sm"
              >
                <span className="w-8 text-xs text-muted-foreground">{ordinal(i + 1)}</span>
                <span className="flex-1">{personById.get(w)?.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={i === 0}
                  onClick={() => moveWife(i, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={i === wives.length - 1}
                  onClick={() => moveWife(i, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalChildren === 0 ? (
        <p className="text-sm text-muted-foreground">This parent has no children yet.</p>
      ) : (
        groupDefs.map((d) => {
          const rows = groups[d.key] ?? [];
          if (rows.length === 0 && d.motherId === null && wives.length > 0) return null;
          return (
            <div key={d.key} className="space-y-1">
              {wives.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">{d.label}</p>
              )}
              {rows.length === 0 ? (
                <p className="rounded border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  No children in this group.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(d.key)}
                >
                  <SortableContext
                    items={rows.map((r) => r.relId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-1">
                      {rows.map((row, i) => (
                        <SortableRow
                          key={row.relId}
                          row={row}
                          index={i}
                          wives={wives}
                          personById={personById}
                          onAssignMother={assignMother}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function SortableRow({
  row,
  index,
  wives,
  personById,
  onAssignMother,
}: {
  row: Row;
  index: number;
  wives: string[];
  personById: Map<string, Person>;
  onAssignMother: (row: Row, motherId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.relId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded border bg-background px-3 py-2 text-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-xs text-muted-foreground">{index + 1}.</span>
      <span className="flex-1 truncate">{row.child.name}</span>
      {wives.length > 0 && (
        <select
          className="rounded border bg-background px-2 py-1 text-xs"
          value={row.motherId ?? NONE}
          onChange={(e) =>
            onAssignMother(row, e.target.value === NONE ? null : e.target.value)
          }
          aria-label="Mother"
        >
          <option value={NONE}>Mother: not set</option>
          {wives.map((w) => (
            <option key={w} value={w}>
              Mother: {personById.get(w)?.name}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
