import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Trash2, KeyRound, LogOut, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FileShare" }] }),
  component: Dashboard,
});

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  let v = n;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(1)} ${u[i]}`;
}

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

function fmtExpiry(expiresAt: string): {
  relative: string;
  expired: boolean;
  urgent: boolean;
  warning: boolean;
} {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;
  if (diff < 0) return { relative: "expired", expired: true, urgent: false, warning: false };
  if (diff < 3600_000)
    return {
      relative: `${Math.round(diff / 60_000)}m`,
      expired: false,
      urgent: true,
      warning: false,
    };
  if (diff < 86_400_000)
    return {
      relative: `${Math.round(diff / 3_600_000)}h`,
      expired: false,
      urgent: true,
      warning: false,
    };
  if (diff < 259_200_000)
    return {
      relative: `${Math.round(diff / 86_400_000)}d`,
      expired: false,
      urgent: false,
      warning: true,
    };
  return {
    relative: new Date(expiresAt).toLocaleDateString(),
    expired: false,
    urgent: false,
    warning: false,
  };
}

function Dashboard() {
  const qc = useQueryClient();
  const { getToken, signOut } = useAuth();
  const { user } = useUser();

  const drops = useQuery({
    queryKey: ["my-drops"],
    queryFn: async () => {
      const r = await authedFetch(getToken, "/api/public/v1/me/drops");
      if (!r.ok) throw new Error("failed");
      return r.json() as Promise<{
        drops: Array<{
          slug: string;
          name: string;
          size: number;
          expiresAt: string;
          downloads: number;
          maxDownloads: number | null;
          createdAt: string;
          ready: boolean;
          shareUrl: string;
        }>;
      }>;
    },
  });

  const remove = async (slug: string) => {
    if (!confirm(`Delete ${slug}?`)) return;
    const r = await authedFetch(getToken, `/api/public/v1/drops/${slug}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Deleted.");
      qc.invalidateQueries({ queryKey: ["my-drops"] });
    } else toast.error("Delete failed");
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Copied.");
  };

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-xs uppercase tracking-widest text-muted-foreground">
            signed in as {user?.primaryEmailAddress?.emailAddress || user?.id}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Your drops</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/keys">
            <Button variant="outline">
              <KeyRound className="mr-2 h-4 w-4" />
              API keys
            </Button>
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="w-full mono text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3">file</th>
              <th className="px-4 py-3">size</th>
              <th className="px-4 py-3">downloads</th>
              <th className="px-4 py-3">expires</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {drops.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  loading…
                </td>
              </tr>
            )}
            {drops.data?.drops.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No drops yet.{" "}
                  <Link to="/" className="text-accent hover:underline">
                    Send your first →
                  </Link>
                </td>
              </tr>
            )}
            {drops.data?.drops.map((d) => {
              const expiry = fmtExpiry(d.expiresAt);
              return (
                <tr
                  key={d.slug}
                  className={`border-t border-border ${expiry.expired ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link to="/d/$slug" params={{ slug: d.slug }} className="hover:text-accent">
                      {d.name}
                    </Link>
                    {!d.ready && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">pending</span>
                    )}
                    {expiry.expired && (
                      <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                        expired
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtBytes(d.size)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.downloads}
                    {d.maxDownloads ? `/${d.maxDownloads}` : ""}
                  </td>
                  <td
                    className={`px-4 py-3 ${expiry.urgent ? "text-destructive" : expiry.warning ? "text-amber-500" : "text-muted-foreground"}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {(expiry.urgent || expiry.warning) &&
                        !expiry.expired &&
                        (expiry.urgent ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        ))}
                      {expiry.relative}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(d.shareUrl)}
                      disabled={expiry.expired}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(d.slug)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
