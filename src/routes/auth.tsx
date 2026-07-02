import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { ShieldCheck, Users, Eye } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · Family Tree" }] }),
  component: AuthPage,
});

type TabId = "admin" | "family" | "viewer";

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("family");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Welcome to the Family Tree</h1>
          <p className="text-sm text-muted-foreground">Choose how you'd like to enter.</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="admin" className="gap-1"><ShieldCheck className="h-4 w-4" />Admin</TabsTrigger>
            <TabsTrigger value="family" className="gap-1"><Users className="h-4 w-4" />Family</TabsTrigger>
            <TabsTrigger value="viewer" className="gap-1"><Eye className="h-4 w-4" />Viewer</TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="mt-4">
            <AdminSignIn onDone={() => navigate({ to: "/admin" })} />
          </TabsContent>

          <TabsContent value="family" className="mt-4">
            <FamilySignIn onDone={() => navigate({ to: "/" })} />
          </TabsContent>

          <TabsContent value="viewer" className="mt-4">
            <ViewerEntry onEnter={() => navigate({ to: "/" })} />
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="underline">Back to the tree</Link>
        </p>
      </div>
    </div>
  );
}

function AdminSignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: data.user!.id,
        _role: "admin",
      });
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account is not an admin.");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Admin-only sign-in. Manage the tree, users and requests.</p>
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <Label htmlFor="ae">Admin email</Label>
          <Input id="ae" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ap">Password</Label>
          <Input id="ap" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in as admin"}
        </Button>
      </form>
    </div>
  );
}

function FamilySignIn({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || email },
          },
        });
        if (error) throw error;
        toast.success("Account created.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) { toast.error("Google sign-in failed"); return; }
      if (result.redirected) return;
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sign in to see your spot on the tree or request to be added.
      </p>
      <Button type="button" variant="outline" className="w-full" onClick={google} disabled={loading}>
        Continue with Google
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <form className="space-y-3" onSubmit={submit}>
        {mode === "signup" && (
          <div>
            <Label htmlFor="fn">Full name</Label>
            <Input id="fn" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
        )}
        <div>
          <Label htmlFor="fe">Email</Label>
          <Input id="fe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="fp">Password</Label>
          <Input id="fp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}

function ViewerEntry({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted-foreground">
        Browse the family tree without signing in. You'll still be able to view every person and their story.
      </p>
      <Button className="w-full" onClick={onEnter}>Continue as viewer</Button>
      <p className="text-xs text-muted-foreground">
        Want to appear on the tree? Use the Family tab to sign up.
      </p>
    </div>
  );
}
