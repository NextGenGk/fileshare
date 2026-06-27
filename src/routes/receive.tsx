import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Shield, FileText, ArrowRight, Check, Copy } from "lucide-react";
import { QrCode } from "@/components/qr-code";
import { toast } from "sonner";

export const Route = createFileRoute("/receive")({
  head: () => ({ meta: [{ title: "Receive a file — FileShare" }] }),
  component: ReceivePage,
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

function ReceivePage() {
  const [code, setCode] = useState("");
  const [lookedUp, setLookedUp] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  const meta = useQuery({
    queryKey: ["claim", code],
    enabled: lookedUp && code.length >= 4,
    queryFn: async () => {
      const r = await fetch(`/api/public/v1/claims/${code}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || data.error || "invalid_code");
      return data as {
        name: string;
        size: number;
        expiresAt: string;
        downloadCount: number;
        maxDownloads: number | null;
        contentType: string;
        slug: string;
      };
    },
    retry: false,
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      toast.error("Enter the full 4-digit code");
      return;
    }
    setLookedUp(true);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const r = await fetch(`/api/public/v1/claims/${code}/download`, { method: "POST" });
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
      setCompleted(true);
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = async () => {
    if (!meta.data?.slug) return;
    await navigator.clipboard.writeText(window.location.origin + "/d/" + meta.data.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-3 text-2xl font-semibold">Receive a file</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 4-digit code the sender shared with you.
        </p>
      </div>

      <form onSubmit={handleLookup} className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="mono text-center text-2xl tracking-[0.4em] h-14 flex-1 min-w-0"
        />
        <Button type="submit" disabled={code.length < 4 || meta.isFetching} className="h-14 px-6">
          {meta.isFetching ? "…" : <ArrowRight className="h-5 w-5" />}
        </Button>
      </form>

      {meta.isError && lookedUp && (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center">
          <p className="mono text-xs uppercase tracking-widest text-destructive">
            invalid or expired
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This code isn't valid or the file has expired. Ask the sender for a new one.
          </p>
        </div>
      )}

      {meta.data && !completed && (
        <div className="mt-6 rounded-md border border-border bg-card p-6 text-center">
          <FileText className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-3 text-lg font-semibold break-all">{meta.data.name}</h2>
          <p className="mono mt-1 text-sm text-muted-foreground">
            {fmtBytes(meta.data.size)} · expires {new Date(meta.data.expiresAt).toLocaleString()}
          </p>
          <p className="mono mt-1 text-xs text-muted-foreground">
            {meta.data.downloadCount} downloaded
            {meta.data.maxDownloads ? ` of ${meta.data.maxDownloads}` : ""}
          </p>
          <Button onClick={handleDownload} disabled={downloading} size="lg" className="mt-6 w-full">
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Downloading…" : "Download"}
          </Button>
          <button
            onClick={copyLink}
            className="mono mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
            {copied ? "Link copied" : "Copy direct link"}
          </button>
          <p className="mono mt-4 text-xs text-muted-foreground">this code works once</p>
          {meta.data?.slug && (
            <div className="mt-4 flex justify-center">
              <QrCode
                value={`${window.location.origin}/d/${meta.data.slug}`}
                size={120}
                label="scan to open"
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link to="/" className="mono text-xs uppercase tracking-widest text-accent hover:underline">
          ← send a file instead
        </Link>
      </div>
    </div>
  );
}
