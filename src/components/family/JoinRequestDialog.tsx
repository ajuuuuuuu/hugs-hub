import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Person } from "@/lib/family-data";

export function JoinRequestDialog({
  open,
  onOpenChange,
  persons,
  userId,
  defaultName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  persons: Person[];
  userId: string;
  defaultName: string;
  onSubmitted: () => void;
}) {
  const [parentId, setParentId] = useState("");
  const [relation, setRelation] = useState<"son" | "daughter">("son");
  const [name, setName] = useState(defaultName);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [birthDate, setBirthDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? persons.filter((p) => p.name.toLowerCase().includes(q)) : persons;
    return list.slice(0, 50);
  }, [persons, search]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentId || !name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("join_requests").insert({
      user_id: userId,
      parent_person_id: parentId,
      relation,
      proposed_name: name.trim(),
      proposed_gender: relation === "son" ? "male" : relation === "daughter" ? "female" : gender,
      proposed_birth_date: birthDate || null,
      proposed_photo_url: photoUrl || null,
      proposed_biography: bio.trim() || null,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request sent to admin");
    onSubmitted();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add me to the family tree</DialogTitle>
          <DialogDescription>
            Pick your father or mother in the tree. Admin will review and approve.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <Label>Search for parent</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name…"
              className="mt-1"
            />
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select your parent" />
              </SelectTrigger>
              <SelectContent>
                {filtered.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.birthDate ? ` (b. ${p.birthDate.slice(0, 4)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>I am their</Label>
            <Select value={relation} onValueChange={(v) => setRelation(v as "son" | "daughter")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="son">Son</SelectItem>
                <SelectItem value="daughter">Daughter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Birth date</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Photo (optional)</Label>
              <Input type="file" accept="image/*" onChange={handleFile} className="mt-1" />
            </div>
          </div>
          {photoUrl && <img src={photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />}
          <div>
            <Label>Short bio (optional)</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div>
            <Label>Message to admin (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !parentId || !name.trim()}>
              {submitting ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}