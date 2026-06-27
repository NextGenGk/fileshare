import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileText, Lock, Shield, Copy, Check } from "lucide-react";
import { QrCode } from "@/components/qr-code";
import { toast } from "sonner";

export const Route = createFileRoute("/d/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Download · ${params.slug} — FileShare` },
      { name: "description", content: "Download a shared file via FileShare." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DropPage,
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

function DropPage() {
  const { slug } = Route.useParams();
  const [password, setPassword] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = useQuery({
    queryKey: ["drop", slug],
    queryFn: async () => {
      const r = await fetch(`/api/public/v1/drops/${slug}`);
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || err.error || "not_found");
      }
      return r.json() as Promise<{
        name: string;
        size: number;
        expiresAt: string;
        downloadCount: number;
        maxDownloads: number | null;
        requiresPassword: boolean;
        requiresClaim: boolean;
      }>;
    },
    retry: false,
  });

  const onDownload = async () => {
    setDownloading(true);
    try {
      const r = await fetch(`/api/public/v1/drops/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: password || undefined,
        }),
      });
      if (!r.ok) {
        const j = await r.json();
        toast.error(j.message || j.error || "failed");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.data?.name || "download";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (meta.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 mono text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (meta.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="mono text-xs uppercase tracking-widest text-destructive">404 / expired</p>
        <h1 className="mt-2 text-2xl font-semibold">This drop isn't available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have expired, hit its download limit, or never existed.
        </p>
        <Link
          to="/"
          className="mono mt-6 inline-flex text-xs uppercase tracking-widest text-accent hover:underline"
        >
          ← send your own
        </Link>
      </div>
    );
  }

  const d = meta.data!;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="rounded-md border border-border bg-card p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-accent" />
        <h1 className="mt-4 break-all text-xl font-semibold">{d.name}</h1>
        <p className="mono mt-1 text-sm text-muted-foreground">
          {fmtBytes(d.size)} · expires {new Date(d.expiresAt).toLocaleString()}
        </p>
        <p className="mono mt-1 text-xs text-muted-foreground">
          {d.downloadCount} downloaded{d.maxDownloads ? ` of ${d.maxDownloads}` : ""}
        </p>

        {d.requiresPassword && (
          <div className="mt-6 flex items-center gap-2 rounded border border-border bg-muted/40 px-3 py-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mono border-0 bg-transparent shadow-none focus-visible:ring-0 flex-1 min-w-0"
            />
          </div>
        )}

        {d.requiresClaim && (
          <div className="mt-6 rounded border border-accent/40 bg-accent/5 p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <p className="mono text-xs uppercase tracking-widest text-accent">
                claim code required
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This file uses a claim code for delivery.{" "}
              <Link to="/receive" className="text-accent hover:underline">
                Enter your code here →
              </Link>
            </p>
          </div>
        )}

        {!d.requiresClaim && (
          <Button onClick={onDownload} disabled={downloading} size="lg" className="mt-6 w-full">
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Preparing…" : "Download"}
          </Button>
        )}

        <button
          onClick={copyLink}
          className="mono mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy link"}
        </button>

        <div className="mt-6 flex justify-center">
          <QrCode value={window.location.href} size={120} label="Scan to open" />
        </div>
      </div>
    </div>
  );
}
