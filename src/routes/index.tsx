import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FamilyTree } from "@/components/family/FamilyTree";
import { PersonDetail } from "@/components/family/PersonDetail";
import { JoinRequestDialog } from "@/components/family/JoinRequestDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MAIN_FAMILY } from "@/lib/family-data";
import { fetchFamily } from "@/lib/family-api";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Family Tree" },
      { name: "description", content: "Explore the interactive family tree." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, role, isFamilyMember, signOut, refreshProfile } = useAuth();
  // Broadcast presence so admins can see who's online
  usePresence({
    userId: user?.id ?? null,
    displayName: profile?.display_name ?? user?.email ?? "Guest",
    role: isAdmin ? "admin" : isFamilyMember ? "family_member" : role === "visitor" ? "visitor" : "new_member",
  });
  const { data, refetch } = useQuery({
    queryKey: ["family"],
    queryFn: fetchFamily,
  });
  const persons = data?.persons ?? [];
  const relationships = data?.relationships ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [branchPersonId, setBranchPersonId] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  // Auto-highlight the user's own node when they're linked to one
  useEffect(() => {
    if (profile?.person_id) setHighlightId(profile.person_id);
  }, [profile?.person_id]);

  // Check whether user already has a pending request
  useEffect(() => {
    if (!user) {
      setPendingRequest(false);
      return;
    }
    supabase
      .from("join_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => setPendingRequest(Boolean(data)));
  }, [user]);

  // Immediate relatives (parents, spouses, children) of the highlighted node
  const relatedIds = useMemo(() => {
    if (!highlightId) return new Set<string>();
    const ids = new Set<string>();
    relationships.forEach((r) => {
      if (r.type === "parent") {
        if (r.person2Id === highlightId) ids.add(r.person1Id); // parent
        if (r.person1Id === highlightId) ids.add(r.person2Id); // child
      } else if (r.type === "spouse") {
        if (r.person1Id === highlightId) ids.add(r.person2Id);
        if (r.person2Id === highlightId) ids.add(r.person1Id);
      }
    });
    return ids;
  }, [relationships, highlightId]);

  const mainPersonIds = useMemo(() => {
    const ids = new Set(
      persons.filter((p) => (p.familyGroup ?? MAIN_FAMILY) === MAIN_FAMILY).map((p) => p.id),
    );
    relationships.forEach((r) => {
      if (r.type !== "spouse") return;
      if (ids.has(r.person1Id)) ids.add(r.person2Id);
      if (ids.has(r.person2Id)) ids.add(r.person1Id);
    });
    return ids;
  }, [persons, relationships]);

  const mainPersons = useMemo(
    () => persons.filter((p) => mainPersonIds.has(p.id)),
    [persons, mainPersonIds],
  );
  const mainRelationships = useMemo(
    () =>
      relationships.filter(
        (r) => mainPersonIds.has(r.person1Id) && mainPersonIds.has(r.person2Id),
      ),
    [relationships, mainPersonIds],
  );

  const branchPerson = branchPersonId
    ? persons.find((p) => p.id === branchPersonId) ?? null
    : null;
  const branchGroup = branchPerson?.familyGroup;
  const branchPersons = useMemo(
    () => (branchGroup ? persons.filter((p) => p.familyGroup === branchGroup) : []),
    [persons, branchGroup],
  );
  const branchIds = useMemo(() => new Set(branchPersons.map((p) => p.id)), [branchPersons]);
  const branchRelationships = useMemo(
    () =>
      relationships.filter(
        (r) => branchIds.has(r.person1Id) && branchIds.has(r.person2Id),
      ),
    [relationships, branchIds],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return persons.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [persons, query]);

  const myNode = profile?.person_id
    ? persons.find((p) => p.id === profile.person_id)
    : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Family Tree</h1>
          <p className="text-xs text-muted-foreground">
            {user
              ? `${profile?.display_name ?? user.email} · ${
                  isAdmin
                    ? "Admin"
                    : isFamilyMember
                    ? "Family member — your node is highlighted"
                    : role === "visitor"
                    ? "Visitor — explore the tree"
                    : "New member — request to join"
                }`
              : "Sign in as a family member, new member, or visitor"}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name..."
          />
          {matches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
              {matches.map((p) => (
                <button
                  key={p.id}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setSelectedId(p.id);
                    setHighlightId(p.id);
                    setQuery("");
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user && !myNode && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pendingRequest}
              onClick={() => setJoinOpen(true)}
            >
              {pendingRequest ? "Request pending" : "Add me to the tree"}
            </Button>
          )}
          {myNode && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedId(myNode.id);
                setHighlightId(myNode.id);
              }}
            >
              My node
            </Button>
          )}
          {isAdmin && (
            <Link to="/admin">
              <Button variant="secondary" size="sm">Admin</Button>
            </Link>
          )}
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/auth" })}>
              Sign in
            </Button>
          )}
        </div>
      </header>
      <main className="flex-1">
        <FamilyTree
          persons={mainPersons}
          relationships={mainRelationships}
          onSelect={(id) => setHighlightId(id)}
          onOpen={(id) => {
            setHighlightId(id);
            setSelectedId(id);
          }}
          highlightId={highlightId}
          relatedIds={relatedIds}
        />
      </main>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          {selectedId && (
            <PersonDetail
              personId={selectedId}
              persons={persons}
              relationships={relationships}
              isAdmin={isAdmin}
              currentUserPersonId={profile?.person_id ?? null}
              canViewBirthFamily={isFamilyMember}
              currentUserId={user?.id ?? null}
              currentUserName={profile?.display_name ?? ""}
              currentUserEmail={user?.email ?? ""}
              onClose={() => setSelectedId(null)}
              onViewBirthFamily={(id) => {
                setBranchPersonId(id);
                setSelectedId(null);
              }}
              onChanged={() => refetch()}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!branchPerson} onOpenChange={(o) => !o && setBranchPersonId(null)}>
        <DialogContent className="flex h-[80vh] max-w-5xl flex-col p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              {branchPerson?.name}'s birth family
              {branchGroup ? ` — the ${capitalize(branchGroup)}s` : ""}
            </DialogTitle>
            <DialogDescription>
              Highlighted within their ancestral family tree.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 w-full">
            {branchPerson && (
              <FamilyTree
                persons={branchPersons}
                relationships={branchRelationships}
                onSelect={() => {}}
                highlightId={branchPerson.id}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {user && (
        <JoinRequestDialog
          open={joinOpen}
          onOpenChange={setJoinOpen}
          persons={persons}
          userId={user.id}
          defaultName={profile?.display_name ?? ""}
          onSubmitted={() => {
            setPendingRequest(true);
            refreshProfile();
          }}
        />
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
