import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Trash2, Plus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/keys")({
  head: () => ({ meta: [{ title: "API keys — FileShare" }] }),
  component: Keys,
});

async function authedFetch(
  getToken: ((options?: { template?: string }) => Promise<string | null>) | undefined,
  path: string,
  init: RequestInit = {},
) {
  const token = await getToken?.();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

type Key = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function Keys() {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const r = await authedFetch(getToken, "/api/public/v1/me/keys");
      if (!r.ok) throw new Error("failed");
      return r.json() as Promise<{ keys: Key[] }>;
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await authedFetch(getToken, "/api/public/v1/me/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const j = await r.json();
    if (!r.ok) {
      toast.error(j.message || j.error || "failed");
      return;
    }
    setFresh(j.token);
    setName("");
    qc.invalidateQueries({ queryKey: ["api-keys"] });
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key?")) return;
    const r = await authedFetch(getToken, `/api/public/v1/me/keys/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Revoked.");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        to="/dashboard"
        className="mono inline-flex items-center text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-3 w-3" /> dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">API keys</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use these for the CLI or your own scripts. They act on your behalf.
      </p>

      <form onSubmit={create} className="mt-6 flex flex-wrap gap-2">
        <Input
          className="mono"
          placeholder="key name (e.g. laptop)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit">
          <Plus className="mr-1 h-4 w-4" />
          Create
        </Button>
      </form>

      {fresh && (
        <div className="mt-4 rounded-md border border-accent bg-accent/5 p-4">
          <p className="mono text-xs uppercase tracking-widest text-accent">
            save this token — shown once
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-3 py-2 mono text-sm">
              {fresh}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(fresh);
                toast.success("Copied.");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mono mt-2 text-xs text-muted-foreground">
            export FILESHARE_API_KEY={fresh.slice(0, 12)}…
          </p>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="w-full mono text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">name</th>
              <th className="px-4 py-3">prefix</th>
              <th className="px-4 py-3">last used</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.keys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  no keys yet
                </td>
              </tr>
            )}
            {list.data?.keys.map((k) => (
              <tr key={k.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {k.name}
                  {k.revoked_at && <span className="ml-2 text-xs text-destructive">revoked</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{k.key_prefix}…</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                </td>
                <td className="px-4 py-3 text-right">
                  {!k.revoked_at && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
