import { useState } from "react";
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
import type { Person, Gender } from "@/lib/family-data";

export function PersonEditor({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Person>;
  onSubmit: (data: Omit<Person, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "male");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [deathDate, setDeathDate] = useState(initial?.deathDate ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [biography, setBiography] = useState(initial?.biography ?? "");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          gender,
          birthDate: birthDate || undefined,
          deathDate: deathDate || undefined,
          photoUrl: photoUrl || undefined,
          biography: biography || undefined,
        });
      }}
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Gender</Label>
        <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Birth date</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Death date</Label>
          <Input type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Photo</Label>
        <Input type="file" accept="image/*" onChange={handleFile} className="mt-1" />
        {photoUrl && <img src={photoUrl} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />}
      </div>
      <div>
        <Label>Biography</Label>
        <Textarea value={biography} onChange={(e) => setBiography(e.target.value)} rows={3} className="mt-1" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}