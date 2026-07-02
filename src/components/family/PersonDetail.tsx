import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SuggestionForm } from "./SuggestionForm";
import { PersonEditor } from "./PersonEditor";
import {
  addPerson,
  addRelationship,
  addWife,
  deletePerson,
  updatePerson,
} from "@/lib/family-api";
import { MAIN_FAMILY, type Person, type Relationship } from "@/lib/family-data";
import { toast } from "sonner";

export function PersonDetail({
  personId,
  persons,
  relationships,
  isAdmin,
  currentUserPersonId = null,
  canViewBirthFamily = false,
  currentUserId = null,
  currentUserName = "",
  currentUserEmail = "",
  onClose,
  onViewBirthFamily,
  onChanged,
}: {
  personId: string;
  persons: Person[];
  relationships: Relationship[];
  isAdmin: boolean;
  currentUserPersonId?: string | null;
  canViewBirthFamily?: boolean;
  currentUserId?: string | null;
  currentUserName?: string;
  currentUserEmail?: string;
  onClose: () => void;
  onViewBirthFamily?: (id: string) => void;
  onChanged: () => void;
}) {
  const person = persons.find((p) => p.id === personId);
  const [mode, setMode] = useState<"view" | "suggest" | "edit" | "addDesc" | "addWife">("view");

  if (!person) return null;

  const isSelf = currentUserPersonId === person.id;
  const canEdit = isAdmin || isSelf;
  const canAddWife = isAdmin && person.gender === "male";

  const parents = relationships
    .filter((r) => r.type === "parent" && r.person2Id === person.id)
    .map((r) => persons.find((p) => p.id === r.person1Id))
    .filter(Boolean) as Person[];
  const children = relationships
    .filter((r) => r.type === "parent" && r.person1Id === person.id)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((r) => persons.find((p) => p.id === r.person2Id))
    .filter(Boolean) as Person[];
  const spouses = relationships
    .filter(
      (r) =>
        r.type === "spouse" && (r.person1Id === person.id || r.person2Id === person.id),
    )
    .map((r) =>
      persons.find((p) => p.id === (r.person1Id === person.id ? r.person2Id : r.person1Id)),
    )
    .filter(Boolean) as Person[];

  async function run(fn: () => Promise<unknown>, msg = "Saved") {
    try {
      await fn();
      toast.success(msg);
      onChanged();
      setMode("view");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-start gap-4">
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
            {person.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{person.name}</h2>
          <p className="text-sm text-muted-foreground capitalize">{person.gender}</p>
          <p className="text-sm text-muted-foreground">
            {person.birthDate || "?"} {person.deathDate ? `– ${person.deathDate}` : ""}
          </p>
        </div>
      </div>

      {person.biography && (
        <p className="text-sm leading-relaxed text-foreground">{person.biography}</p>
      )}

      <Separator />

      <div className="space-y-2 text-sm">
        <Relation label="Parents" people={parents} />
        <Relation label="Spouses" people={spouses} />
        <Relation label="Children" people={children} />
      </div>

      <Separator />

      {mode === "view" && (
        <div className="flex flex-wrap gap-2">
          {person.familyGroup && person.familyGroup !== MAIN_FAMILY && onViewBirthFamily && (isAdmin || canViewBirthFamily) && (
            <Button size="sm" variant="secondary" onClick={() => onViewBirthFamily(person.id)}>
              View birth family tree
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setMode("suggest")}>
            Suggest a correction
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setMode("edit")}>
              {isAdmin ? "Edit" : "Edit my info"}
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setMode("addDesc")}>
                Add descendant
              </Button>
              {canAddWife && (
                <Button size="sm" variant="secondary" onClick={() => setMode("addWife")}>
                  Add wife
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete ${person.name}?`)) {
                    run(async () => {
                      await deletePerson(person.id);
                      onClose();
                    }, "Deleted");
                  }
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      )}

      {mode === "suggest" && (
        <SuggestionForm
          personId={person.id}
          personName={person.name}
          userId={currentUserId}
          defaultName={currentUserName}
          defaultEmail={currentUserEmail}
          onClose={() => setMode("view")}
        />
      )}
      {mode === "edit" && (
        <PersonEditor
          initial={person}
          onCancel={() => setMode("view")}
          onSubmit={(data) => run(() => updatePerson(person.id, data))}
        />
      )}
      {mode === "addDesc" && (
        <PersonEditor
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              const child = await addPerson({ ...data, familyGroup: person.familyGroup });
              await addRelationship({ person1Id: person.id, person2Id: child.id, type: "parent" });
            }, "Descendant added")
          }
        />
      )}
      {mode === "addWife" && (
        <PersonEditor
          initial={{ gender: "female" } as Person}
          onCancel={() => setMode("view")}
          onSubmit={(data) =>
            run(async () => {
              await addWife(person.id, {
                name: data.name,
                birthDate: data.birthDate,
                deathDate: data.deathDate,
                photoUrl: data.photoUrl,
                biography: data.biography,
                familyGroup: person.familyGroup,
              });
            }, "Wife added")
          }
        />
      )}
    </div>
  );
}

function Relation({ label, people }: { label: string; people: Person[] }) {
  if (!people.length) return null;
  return (
    <div>
      <span className="font-medium text-muted-foreground">{label}: </span>
      <span>{people.map((p) => p.name).join(", ")}</span>
    </div>
  );
}
