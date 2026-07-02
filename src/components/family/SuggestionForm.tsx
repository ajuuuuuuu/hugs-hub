import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Persist a correction/info suggestion to the database for admin review. */
export function SuggestionForm({
  personId,
  personName,
  defaultName = "",
  defaultEmail = "",
  userId = null,
  onClose,
}: {
  personId: string;
  personName: string;
  defaultName?: string;
  defaultEmail?: string;
  userId?: string | null;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        setSubmitting(true);
        const { error } = await supabase.from("suggestions").insert({
          person_id: personId,
          user_id: userId,
          submitter_name: name.trim() || null,
          submitter_email: email.trim() || null,
          message: message.trim(),
        });
        setSubmitting(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Thanks — your note about " + personName + " was sent to the admin.");
        onClose();
      }}
    >
      {!userId && (
        <>
          <div>
            <Label htmlFor="sname">Your name</Label>
            <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="semail">Your email (optional)</Label>
            <Input id="semail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="msg">What seems incorrect or missing?</Label>
        <Textarea id="msg" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Submit"}</Button>
      </div>
    </form>
  );
}
