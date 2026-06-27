import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      { title: "FileShare — send big files, fast" },
      {
        name: "description",
        content: "Drop a file. Share a link. Up to 2GB. Expires automatically.",
      },
      { property: "og:title", content: "FileShare — send big files, fast" },
      {
        property: "og:description",
        content: "Drop a file. Share a link. Up to 2GB. Expires automatically.",
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
  const [files, setFiles] = useState<File[] | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"link" | "password" | "otp">("link");
  const [password, setPassword] = useState<string>("");
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
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const uploadSingle = useCallback(
    async (f: File) => {
      if (f.size > 2 * 1024 * 1024 * 1024) {
        toast.error("File exceeds 2 GB limit");
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
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            filename: f.name,
            size: f.size,
            contentType: f.type || "application/octet-stream",
            deliveryMode,
            password: deliveryMode === "password" ? password : undefined,
            expiresInDays: expires,
            maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
          }),
        });
        const result = await init.json();
        if (!init.ok) throw new Error(result.message || result.error || "init failed");

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", result.uploadUrl);
          xhr.setRequestHeader("Content-Type", f.type || "application/octet-stream");
          xhr.upload.onprogress = (e) =>
            e.lengthComputable && setProgress((e.loaded / e.total) * 100);
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`upload ${xhr.status}`));
          xhr.onerror = () => reject(new Error("network error"));
          xhr.send(f);
        });

        const doneRes = await fetch(`/api/public/v1/uploads/${result.id}/complete`, {
          method: "POST",
          headers: authHeader,
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
    [deliveryMode, password, expires, maxDownloads, isSignedIn, getToken],
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
        if (totalSize > 2 * 1024 * 1024 * 1024) {
          toast.error("Compressed files exceed 2 GB limit");
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
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            filename: zipName,
            size: totalSize,
            contentType: "application/zip",
            deliveryMode,
            password: deliveryMode === "password" ? password : undefined,
            expiresInDays: expires,
            maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
          }),
        });
        const result = await init.json();
        if (!init.ok) throw new Error(result.message || result.error || "init failed");

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", result.uploadUrl);
          xhr.setRequestHeader("Content-Type", "application/zip");
          xhr.upload.onprogress = (e) =>
            e.lengthComputable && setProgress((e.loaded / e.total) * 100);
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`upload ${xhr.status}`));
          xhr.onerror = () => reject(new Error("network error"));
          xhr.send(blob);
        });

        const doneRes = await fetch(`/api/public/v1/uploads/${result.id}/complete`, {
          method: "POST",
          headers: authHeader,
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
    [deliveryMode, password, expires, maxDownloads, uploadSingle, isSignedIn, getToken],
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
    setPassword("");
    setDeliveryMode("link");
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
              <div className="space-y-3 pt-2 lg:inline-block lg:text-left text-left">
                <div className="flex items-center gap-3 lg:justify-start justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
                    <Upload className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Files, folders, videos, or .zip
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
                    <Clock className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Auto-expiring links (up to 30 days)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
                    <Lock className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Optional password &amp; claim code protection
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
                    <Server className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    REST API &amp; CLI for power users
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card shadow-lg shadow-accent/5 h-full">
              <div className="p-6 sm:p-8">
                {!sent ? (
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
                      <input
                        ref={folderInputRef}
                        type="file"
                        // @ts-expect-error webkitdirectory is a non-standard attribute
                        webkitdirectory=""
                        className="hidden"
                        onChange={onFilePicked}
                      />
                      <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground group-hover:text-accent transition-colors" />
                      <p className="mono text-sm uppercase tracking-widest text-muted-foreground">
                        {progress !== null
                          ? `${files?.[0]?.name ?? "files"} · ${progress.toFixed(0)}%`
                          : fileSummary
                            ? fileSummary
                            : "Drop files, folders, or .zip here"}
                      </p>
                      {progress !== null && progress < 100 && (
                        <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                      {progress === null && !fileSummary && (
                        <div className="mt-4 flex items-center justify-center gap-3">
                          <span
                            className="mono inline-flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              inputRef.current?.click();
                            }}
                          >
                            <Upload className="h-3 w-3" />
                            Files
                          </span>
                          <span className="text-muted-foreground/40">|</span>
                          <span
                            className="mono inline-flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              folderInputRef.current?.click();
                            }}
                          >
                            <Folder className="h-3 w-3" />
                            Folder
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-border/60 p-3.5">
                        <Label
                          htmlFor="delivery"
                          className="mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                        >
                          Delivery
                        </Label>
                        <Select
                          value={deliveryMode}
                          onValueChange={(v) => setDeliveryMode(v as "link" | "password" | "otp")}
                        >
                          <SelectTrigger className="mt-1.5 h-8 mono text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="link" className="mono text-xs">
                              Link only
                            </SelectItem>
                            <SelectItem value="password" className="mono text-xs">
                              Password
                            </SelectItem>
                            <SelectItem value="otp" className="mono text-xs">
                              Claim code
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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

                    <div className="mt-3">
                      {deliveryMode === "password" && (
                        <div className="rounded-lg border border-border/60 p-3.5">
                          <Label
                            htmlFor="pw"
                            className="mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                          >
                            Password
                          </Label>
                          <Input
                            id="pw"
                            type="text"
                            placeholder="Set a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1.5 h-8 mono text-xs"
                          />
                        </div>
                      )}

                      {deliveryMode === "otp" && (
                        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3.5">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-accent" />
                            <p className="mono text-[10px] uppercase tracking-[0.15em] text-accent">
                              Claim code protection
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            A 4-digit code is generated after upload. Share it with the receiver.
                          </p>
                        </div>
                      )}
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

                    <div className="mt-6 w-full space-y-1.5">
                      <p className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {sent.claimCode ? "Claim code — share this" : "Share link"}
                      </p>
                      {sent.claimCode ? (
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
                      ) : (
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
                      )}
                    </div>

                    <p className="mt-4 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Expires{" "}
                      {new Date(sent.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {sent.deliveryMode === "password" && " · password protected"}
                      {sent.claimCode &&
                        ` · ${new Date(sent.expiresAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}`}
                    </p>

                    <div className="mt-6">
                      <QrCode
                        value={sent.claimCode ? `${window.location.origin}/receive` : sent.shareUrl}
                        size={110}
                        label=""
                      />
                      <p className="mono mt-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                        {sent.claimCode ? "Scan to receive" : "Scan to download"}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                      <Button onClick={reset} variant="default" size="sm">
                        Send another
                      </Button>
                      <Button variant="outline" size="sm" onClick={copy}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Copy link
                      </Button>
                      {!sent.claimCode && (
                        <Link to="/d/$slug" params={{ slug: sent.shareUrl.split("/d/")[1] }}>
                          <Button variant="ghost" size="sm">
                            Open page <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
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
              <p className="text-xl font-bold sm:text-3xl">2 GB</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Max transfer size
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">30 d</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Auto-expiry
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">CLI</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Terminal-native
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold sm:text-3xl">REST</p>
              <p className="mt-1 mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                API included
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-border/40 bg-gradient-to-b from-accent/[0.02] to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent">Also available as</p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl leading-tight">
              CLI &amp; terminal-native
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Install once with npm or curl. Upload files directly from your shell — no browser
              needed.
            </p>
          </div>
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="relative min-w-0 rounded-xl border border-border/60 bg-card p-4 sm:p-6">
              <p className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                npm
              </p>
              <pre className="mt-3 overflow-x-auto mono text-xs sm:text-sm leading-relaxed whitespace-nowrap">{`npx fileshare send ./file.zip`}</pre>
              <button
                onClick={copyNpm}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Copy npm command"
              >
                {npmCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="relative min-w-0 rounded-xl border border-border/60 bg-card p-4 sm:p-6">
              <p className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                curl
              </p>
              <pre className="mt-3 overflow-x-auto mono text-xs sm:text-sm leading-relaxed whitespace-nowrap">{`curl -fsSL ${typeof window !== "undefined" ? window.location.origin : ""}/cli/install.sh | sh`}</pre>
              <button
                onClick={copyCurl}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Copy curl command"
              >
                {curlCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/docs"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground mono uppercase tracking-widest"
            >
              Read the docs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-28">
          <div className="max-w-2xl">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent">About</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl leading-tight">
              Built for people
              <br />
              who send things daily.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              We built the file transfer service we always wanted but could never find — fast, works
              in a browser or terminal, and designed around how people actually share files. No
              accounts, no subscriptions, no bloat.
            </p>
          </div>

          <div className="mt-12 sm:mt-16">
            <p className="mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6 sm:mb-8">
              Why existing tools fall short
            </p>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <p className="mono text-sm font-semibold">Email attachments</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Tiny size limits, clogs inboxes, and IT policies block anything useful. Great for
                  a PDF. Useless for real work.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <p className="mono text-sm font-semibold">WeTransfer</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Consumer-grade bloat. Ads, upsells, and a 2 GB limit that disappears behind a
                  paywall. No CLI, no API, no thanks.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <p className="mono text-sm font-semibold">Google Drive / Dropbox</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Built for sync and collaboration, not quick shares. Recipients need accounts,
                  permissions are a maze, and links never expire by default.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                <p className="mono text-sm font-semibold">curl-pipe services</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Promised terminal-native simplicity. Delivered downtime, tiny limits, and opaque
                  pricing when you outgrew the free tier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-28">
          <div className="max-w-xl">
            <p className="mono text-xs uppercase tracking-[0.2em] text-accent">Why use FileShare</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl leading-tight">
              Built for the way developers share files.
            </h2>
          </div>
          <div className="mt-10 sm:mt-12 grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">01</p>
              <p className="mt-3 mono text-sm font-semibold">Terminal-first</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Install once with <code className="text-foreground">npx fileshare</code>. Upload
                builds, logs, archives, and binaries directly from your shell. Set expiry,
                passwords, and download limits without leaving the terminal.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">02</p>
              <p className="mt-3 mono text-sm font-semibold">Built for real workflows</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                CI artifacts, debug logs too big for a pastebin, test datasets, one-off binaries.
                FileShare stays focused on temporary developer file delivery instead of becoming a
                generic media dump.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">03</p>
              <p className="mt-3 mono text-sm font-semibold">Privacy &amp; control</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Your files stay yours. No broad content licenses, no AI training on your data.
                Burn-after-read, expiry controls, and privacy-first design — you stay in charge.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
              <p className="mono text-xs uppercase tracking-[0.2em] text-accent">04</p>
              <p className="mt-3 mono text-sm font-semibold">Reliable infrastructure</p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Multi-region backend designed for near-zero downtime. We learned from what older
                services got wrong and built something that just works when you need it most.
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
                  You can send files up to 2 GB for free. There are no limits on the number of files
                  you can send, though each upload is capped at 2 GB.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="expiry">
                <AccordionTrigger>How long do files stay available?</AccordionTrigger>
                <AccordionContent>
                  Files are automatically deleted after 30 days. You can also set a custom expiry
                  time when uploading. Once expired, the link stops working and the file is
                  permanently removed from our servers.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="signup">
                <AccordionTrigger>Do I need to create an account?</AccordionTrigger>
                <AccordionContent>
                  No sign-up is required. Just upload your file and share the link. If you want to
                  track downloads or manage your files, you can optionally create a free account.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="secure">
                <AccordionTrigger>Are my files secure?</AccordionTrigger>
                <AccordionContent>
                  Yes. All transfers are encrypted in transit using TLS. You can optionally add a
                  password and a claim code to your share link for an extra layer of security. Files
                  are stored encrypted and automatically purged after expiry.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cli">
                <AccordionTrigger>Can I use FileShare from the command line?</AccordionTrigger>
                <AccordionContent>
                  Absolutely. FileShare has a CLI client that lets you upload files directly from
                  your terminal using curl or our dedicated CLI tool. Perfect for scripting and
                  CI/CD pipelines.
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
            No sign-up required. Files expire automatically. Up to 2 GB.
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
