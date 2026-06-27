import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Shield, FileText, ArrowRight, Check, Copy, Info } from "lucide-react";
import { QrCode } from "@/components/qr-code";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

export function ReceiveForm({ onCancel, embedded }: { onCancel?: () => void; embedded?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
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
      const r = await fetch(`/api/public/v1/claims/${code}`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.message || j.error || "failed");
        return;
      }
      
      // Standard browser download by redirecting to the presigned URL
      window.location.href = j.url;
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
    <div className="w-full">
      <div className="mb-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-accent" />
        <h2 className="mt-3 text-2xl font-semibold">Receive a file</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 4-digit code the sender shared with you.
        </p>
      </div>

      {isLoaded && !isSignedIn && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-muted/60 bg-muted/30 px-4 py-2.5 text-left">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <Link to="/auth" className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to keep a history of your shared files
          </p>
        </div>
      )}

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

      <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3.5 text-left">
        <p className="mono text-[10px] uppercase tracking-[0.15em] text-yellow-600 dark:text-yellow-400">
          Note
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Once the link expires, the file is permanently deleted from our servers.
          Download history is only saved if you{" "}
          <Link to="/auth" className="text-accent hover:underline">
            sign in
          </Link>
          .
        </p>
      </div>

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

      <Dialog open={!!meta.data && !completed && lookedUp} onOpenChange={(open) => {
        if (!open) {
          setLookedUp(false);
          setCode("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Download File</DialogTitle>
            <DialogDescription className="text-center">
              Your file is ready to download.
            </DialogDescription>
          </DialogHeader>
          {meta.data && (
            <div className="text-center p-2">
              <FileText className="mx-auto h-8 w-8 text-accent" />
              <h2 className="mt-3 text-lg font-semibold break-all">{meta.data.name}</h2>
              <p className="mono mt-1 text-sm text-muted-foreground">
                {fmtBytes(meta.data.size)} · expires {new Date(meta.data.expiresAt).toLocaleString()}
              </p>
              <p className="mono mt-1 text-xs text-muted-foreground">
                {meta.data.downloadCount} downloaded
                {meta.data.maxDownloads ? ` of ${meta.data.maxDownloads}` : ""}
              </p>
              <Button 
                onClick={handleDownload} 
                disabled={downloading} 
                size="lg" 
                className="mt-6 w-full bg-black text-white hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90"
              >
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
        </DialogContent>
      </Dialog>

      {!embedded && (
        <div className="mt-10 text-center">
          {onCancel ? (
            <button
              onClick={onCancel}
              className="mono text-xs uppercase tracking-widest text-accent hover:underline"
            >
              ← send a file instead
            </button>
          ) : (
            <Link to="/" className="mono text-xs uppercase tracking-widest text-accent hover:underline">
              ← send a file instead
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
