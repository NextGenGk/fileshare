import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { put } from "@vercel/blob/client";
import { ReceiveForm } from "@/components/receive-form";

import {
  Upload,
  Copy,
  Check,
  ArrowRight,
  Shield,
  Clock,
  Lock,
  Server,
  Folder,
  Info,
} from "lucide-react";
import { QrCode } from "@/components/qr-code";
import JSZip from "jszip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FileShare — Fast, Simple, Secure Data Transfer" },
      {
        name: "description",
        content: "Securely share files directly from your browser. Full encryption, zero knowledge, fast uploads, and automatic expiry.",
      },
      { property: "og:title", content: "FileShare — Fast, Simple, Secure Data Transfer" },
      {
        property: "og:description",
        content: "Securely share files directly from your browser. Full encryption, zero knowledge, fast uploads, and automatic expiry.",
      },
    ],
  }),
  component: Index,
});

type Sent = {
  shareUrl: string;
  expiresAt: string;
  name: string;
  deliveryMode: "link" | "password" | "otp";
  claimCode?: string;
};

function Index() {
  const [mode, setMode] = useState<"send" | "receive">("send");
  const [files, setFiles] = useState<File[] | null>(null);
  const [expires, setExpires] = useState(30);
  const [maxDownloads, setMaxDownloads] = useState<string>("");
  const [progress, setProgress] = useState<number | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [npmCopied, setNpmCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const uploadSingle = useCallback(
    async (f: File) => {
      if (f.size > 500 * 1024 * 1024) {
        toast.error("File exceeds 500 MB limit");
        return;
      }
      setFiles([f]);
      setProgress(0);
      try {
        let authHeader: Record<string, string> = {};
        if (isSignedIn) {
          const token = await getToken();
          if (token) authHeader = { Authorization: `Bearer ${token}` };
        }
        const init = await fetch("/api/public/v1/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-fileshare-web": "true", ...authHeader },
          body: JSON.stringify({
            filename: f.name,
            size: f.size,
            contentType: f.type || "application/octet-stream",
            deliveryMode: "otp",
            expiresInDays: expires,
            maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
          }),
        });
        const result = await init.json();
        if (!init.ok) throw new Error(result.message || result.error || "init failed");

        // Simulate progress with a timer since onUploadProgress conflicts with multipart mode
        const progressTimer = setInterval(() => {
          setProgress((p) => {
            if (p === null || p >= 90) return p;
            return Math.min(p + (90 - p) * 0.08, 90);
          });
        }, 300);

        let blobResult: { url: string };
        try {
          blobResult = await put(`drops/${result.id}`, f, {
            access: "public",
            token: result.uploadToken,
            contentType: f.type || "application/octet-stream",
            multipart: true,
          });
        } finally {
          clearInterval(progressTimer);
        }
        setProgress(100);

        const doneRes = await fetch(`/api/public/v1/uploads/${result.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ blobUrl: blobResult!.url }),
        });
        const done = await doneRes.json();
        if (!doneRes.ok) throw new Error(done.error || "finalize failed");
        setSent({
          shareUrl: done.shareUrl,
          expiresAt: done.expiresAt,
          name: f.name,
          deliveryMode: result.deliveryMode ?? "link",
          claimCode: result.claimCode,
        });
        setProgress(100);
        toast.success("Uploaded.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
        setProgress(null);
      }
    },
    [expires, maxDownloads, isSignedIn, getToken],
  );

  const uploadFiles = useCallback(
    async (src: File[]) => {
      if (src.length === 0) return;
      // Single file → raw upload (video, zip, etc.)
      if (src.length === 1) {
        await uploadSingle(src[0]);
        return;
      }
      // Multiple files/folders → ZIP client-side
      setFiles(src);
      setProgress(0);
      try {
        const zip = new JSZip();
        for (const f of src) {
          const rel = (f as any).webkitRelativePath || f.name;
          zip.file(rel, f);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const totalSize = blob.size;
        if (totalSize > 500 * 1024 * 1024) {
          toast.error("Compressed files exceed 500 MB limit");
          return;
        }
        const zipName = "files.zip";

        let authHeader: Record<string, string> = {};
        if (isSignedIn) {
          const token = await getToken();
          if (token) authHeader = { Authorization: `Bearer ${token}` };
        }
        const init = await fetch("/api/public/v1/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-fileshare-web": "true", ...authHeader },
          body: JSON.stringify({
            filename: zipName,
            size: totalSize,
            contentType: "application/zip",
            deliveryMode: "otp",
            expiresInDays: expires,
            maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
          }),
        });
        const result = await init.json();
        if (!init.ok) throw new Error(result.message || result.error || "init failed");

        // Simulate progress with a timer since onUploadProgress conflicts with multipart mode
        const progressTimer = setInterval(() => {
          setProgress((p) => {
            if (p === null || p >= 90) return p;
            return Math.min(p + (90 - p) * 0.08, 90);
          });
        }, 300);

        let blobResult: { url: string };
        try {
          blobResult = await put(`drops/${result.id}`, blob, {
            access: "public",
            token: result.uploadToken,
            contentType: "application/zip",
            multipart: true,
          });
        } finally {
          clearInterval(progressTimer);
        }

        const doneRes = await fetch(`/api/public/v1/uploads/${result.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ blobUrl: blobResult!.url }),
        });
        const done = await doneRes.json();
        if (!doneRes.ok) throw new Error(done.error || "finalize failed");
        setSent({
          shareUrl: done.shareUrl,
          expiresAt: done.expiresAt,
          name: zipName,
          deliveryMode: result.deliveryMode ?? "link",
          claimCode: result.claimCode,
        });
        setProgress(100);
        toast.success("Uploaded.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
        setProgress(null);
      }
    },
    [expires, maxDownloads, uploadSingle, isSignedIn, getToken],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) uploadFiles(dropped);
    },
    [uploadFiles],
  );

  const onFilePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files || []);
      if (picked.length > 0) uploadFiles(picked);
      e.target.value = "";
    },
    [uploadFiles],
  );

  const totalSize = files ? files.reduce((s, f) => s + f.size, 0) : 0;
  const fileSummary =
    files && files.length > 0
      ? `${files.length} file${files.length > 1 ? "s" : ""} · ${(totalSize / (1024 * 1024)).toFixed(1)} MB`
      : null;

  const copy = async () => {
    if (!sent) return;
    await navigator.clipboard.writeText(sent.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyCode = async () => {
    if (!sent?.claimCode) return;
    await navigator.clipboard.writeText(sent.claimCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  };

  const copyNpm = async () => {
    await navigator.clipboard.writeText("npx fileshare send ./file.zip");
    setNpmCopied(true);
    setTimeout(() => setNpmCopied(false), 1500);
  };

  const copyCurl = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    await navigator.clipboard.writeText(`curl -fsSL ${url}/cli/install.sh | sh`);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 1500);
  };

  const reset = () => {
    setSent(null);
    setFiles(null);
    setProgress(null);
  };

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.03] to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-6 lg:text-left text-center">
              <span className="mono inline-flex items-center rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-accent lg:mx-0 mx-auto">
                Secure file sharing
              </span>
              <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
                Drop any file.
                <br />
                <span className="text-accent">Share it anywhere.</span>
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-md lg:mx-0 mx-auto">
                Drop a file, get a link. Share it with anyone. Links expire automatically — no
                account required.
              </p>
              <div className="flex flex-wrap items-center gap-4 lg:justify-start justify-center pt-4 pb-2">
                <Button size="lg" variant={mode === "send" ? "default" : "outline"} onClick={() => setMode("send")}>
                  Send file
                </Button>
                <Button size="lg" variant={mode === "receive" ? "default" : "outline"} onClick={() => setMode("receive")}>
                  Receive file
                </Button>
              </div>

            </div>

            <div className="rounded-xl border border-border/60 bg-card shadow-lg shadow-accent/5">
              <div className="p-6 sm:p-8">
                {mode === "receive" ? (
                  <ReceiveForm embedded onCancel={() => setMode("send")} />
                ) : !sent ? (
                  <>
                    {isLoaded && !isSignedIn && (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-muted/60 bg-muted/30 px-4 py-2.5">
                        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          <Link to="/auth" className="text-accent hover:underline">
                            Sign in
                          </Link>{" "}
                          to keep a history of your shared files
                        </p>
                      </div>
                    )}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      onClick={() => inputRef.current?.click()}
                      className={`group relative cursor-pointer rounded-lg border-2 border-dashed p-6 sm:p-10 text-center transition ${
                        dragging
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/60"
                      }`}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={onFilePicked}
                      />

                      <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground group-hover:text-accent transition-colors" />
                      <p className="mono text-sm uppercase tracking-widest text-muted-foreground">
                        {progress !== null
                          ? `${files?.[0]?.name ?? "files"} · ${progress.toFixed(0)}%`
                          : fileSummary
                            ? fileSummary
                            : "Drag and drop any file here"}
                      </p>
                      {progress !== null && (
                        <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-accent transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}

                    </div>

                    {isSignedIn && (
                      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-border/60 p-3.5">
                          <Label
                            htmlFor="expires"
                            className="mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                          >
                            Expires (days)
                          </Label>
                          <Input
                            id="expires"
                            type="number"
                            min={1}
                            max={30}
                            value={expires}
                            onChange={(e) =>
                              setExpires(Math.min(30, Math.max(1, Number(e.target.value) || 1)))
                            }
                            className="mt-1.5 h-8 mono text-xs"
                          />
                        </div>
                        <div className="rounded-lg border border-border/60 p-3.5">
                          <Label
                            htmlFor="maxdl"
                            className="mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                          >
                            Max downloads
                          </Label>
                          <Input
                            id="maxdl"
                            type="number"
                            placeholder="∞"
                            value={maxDownloads}
                            onChange={(e) => setMaxDownloads(e.target.value)}
                            className="mt-1.5 h-8 mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3.5">
                      <p className="mono text-[10px] uppercase tracking-[0.15em] text-yellow-600 dark:text-yellow-400">
                        Note
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Once the link expires, the file is permanently deleted from our servers.
                        Upload history is only saved if you{" "}
                        <Link to="/auth" className="text-accent hover:underline">
                          sign in
                        </Link>
                        .
                      </p>
                    </div>

                  </>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                      <Upload className="h-6 w-6 text-accent" />
                    </div>
                    <p className="mono text-[10px] uppercase tracking-[0.2em] text-accent">
                      Upload complete
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{sent.name}</p>

                    <div className="mt-6 w-full space-y-4">
                      {sent.claimCode && (
                        <div className="space-y-1.5">
                          <p className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            1. Claim Code
                          </p>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <code className="rounded-lg bg-muted px-4 py-2.5 sm:px-5 sm:py-3 mono text-xl sm:text-3xl font-bold tracking-[0.25em] sm:tracking-[0.4em] break-all">
                              {sent.claimCode}
                            </code>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={copyCode}
                              aria-label="Copy code"
                            >
                              {codeCopied ? (
                                <Check className="h-4 w-4 text-accent" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col items-center">
                        <p className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
                          2. QR Code
                        </p>
                        <QrCode
                          value={sent.shareUrl}
                          size={110}
                          label=""
                        />
                      </div>

                      <div className="space-y-1.5">
                        <p className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          3. Share Link
                        </p>
                        <div className="flex items-center justify-center gap-2 max-w-full">
                          <code className="max-w-[160px] sm:max-w-[260px] truncate rounded-lg bg-muted px-4 py-2.5 mono text-sm">
                            {sent.shareUrl}
                          </code>
                          <Button variant="outline" size="icon" onClick={copy} aria-label="Copy">
                            {copied ? (
                              <Check className="h-4 w-4 text-accent" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Expires{" "}
                      {new Date(sent.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {` · ${new Date(sent.expiresAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                      <Button onClick={reset} variant="default" size="sm">
                        Send another
                      </Button>
                      <Button variant="outline" size="sm" onClick={copy}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy link
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-border/40 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid grid-cols-2 gap-4 sm:gap-8 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">500 MB</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Max transfer size
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">5 min</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Guest auto-expiry
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">100%</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Encrypted
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">0</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Logins required
              </p>
            </div>
          </div>
        </div>
      </div>



      <div className="border-t border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-28">
          <div className="max-w-2xl">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent">About</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl leading-tight">
              Fast, simple, secure
              <br />
              <span className="text-orange-500">data transfer.</span>
            </h2>
          </div>

          <div className="mt-12 sm:mt-16 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm flex flex-col gap-3 transition-transform hover:scale-[1.02]">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="mono text-sm font-semibold">Zero Knowledge</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  End-to-end encryption ensures only you and your recipient can see the data.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm flex flex-col gap-3 transition-transform hover:scale-[1.02]">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="mono text-sm font-semibold">Built for Speed</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our global edge network ensures lightning-fast transfer rates from anywhere.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm flex flex-col gap-3 transition-transform hover:scale-[1.02]">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="mono text-sm font-semibold">No Strings Attached</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload instantly without creating an account. Files automatically self-destruct after 5 minutes to leave no trace.
                </p>
              </div>
            </div>

        </div>
      </div>

      <div className="border-y border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-28">
          <div className="max-w-xl">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent">Why use FileShare</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl leading-tight">
              Built for our <span className="text-orange-500">data</span>.
            </h2>
          </div>
          <div className="mt-10 sm:mt-12 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">01</p>
              <p className="mt-3 mono text-sm font-semibold">Fast</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Optimized for speed. No generic bloat or sluggish interfaces. Get your data uploaded and shared in seconds.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">02</p>
              <p className="mt-3 mono text-sm font-semibold">Simple</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                No installations, no complex permission mazes. A straightforward browser-first experience designed exclusively for efficient data transfer.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">03</p>
              <p className="mt-3 mono text-sm font-semibold">Secure</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Burn-after-read options, strict expiry controls, and password protection keep your files secure and ephemeral by default.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">04</p>
              <p className="mt-3 mono text-sm font-semibold">Fully Encrypted</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Your data stays safe in transit and at rest. We prioritize privacy with robust encryption, ensuring our data is never compromised.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent">FAQ</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl leading-tight">
              Frequently asked questions
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible>
              <AccordionItem value="size">
                <AccordionTrigger>What is the maximum file size I can send?</AccordionTrigger>
                <AccordionContent>
                  You can send files up to 500 MB for free. There are no limits on the number of
                  files you can send, though each upload is capped at 500 MB.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="expiry">
                <AccordionTrigger>How long do files stay available?</AccordionTrigger>
                <AccordionContent>
                  Guest uploads automatically expire and are securely deleted after <strong>5 minutes</strong>. Signed-in users can choose custom expiry times up to 30 days. Once expired, files are permanently purged.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="signup">
                <AccordionTrigger>Do I need to create an account?</AccordionTrigger>
                <AccordionContent>
                  No sign-up is required for 5-minute guest transfers. If you want longer expiry times and download tracking, you can create a free account.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="secure">
                <AccordionTrigger>Are my files secure?</AccordionTrigger>
                <AccordionContent>
                  Yes. All data transfers are fully encrypted in transit and at rest. We provide true zero-knowledge file sharing. You can optionally add a password and claim code for an extra layer of security.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="who">
                <AccordionTrigger>Who can download my files?</AccordionTrigger>
                <AccordionContent>
                  Anyone with the share link can download your files. You can optionally require a
                  password or a claim code to restrict access. The link is cryptographically
                  generated and unguessable.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      <div className="bg-accent/5 border-y border-accent/10">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-20 text-center">
          <p className="mono text-xs uppercase tracking-[0.2em] text-accent">Ready to go?</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl leading-tight">
            Drop a file. Share a link.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
            No sign-up required. Files expire automatically. Up to 500 MB.
          </p>
          <Button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="mt-6">
            <Upload className="mr-2 h-4 w-4" />
            Send a file now
          </Button>
        </div>
      </div>
    </div>
  );
}
