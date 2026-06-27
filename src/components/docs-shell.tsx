import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";

export type DocPage = "overview" | "api" | "cli";

export function DocsShell({
  activePage,
  title,
  subtitle,
  sections,
  children,
}: {
  activePage: DocPage;
  title: string;
  subtitle: string;
  sections?: { id: string; label: string }[];
  children: ReactNode;
}) {
  const pages: { id: DocPage; label: string; href: string }[] = [
    { id: "overview", label: "Overview", href: "/docs" },
    { id: "api", label: "REST API", href: "/docs/api" },
    { id: "cli", label: "CLI", href: "/docs/cli" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_14rem]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <section>
              <p className="mono mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
                Get Started
              </p>
              <div className="space-y-1">
                {pages.map((p) => {
                  const isActive = p.id === activePage;
                  return (
                    <Link
                      key={p.id}
                      to={p.href}
                      className={`block rounded-xl px-3 py-2 text-sm transition ${
                        isActive
                          ? "bg-muted/30 text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                      }`}
                    >
                      {p.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </aside>

        <article className="min-w-0">
          <nav className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-border/60 lg:hidden">
            {pages.map((p) => {
              const isActive = p.id === activePage;
              return (
                <Link
                  key={p.id}
                  to={p.href}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs mono uppercase tracking-widest transition ${
                    isActive
                      ? "bg-muted/30 text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  {p.label}
                </Link>
              );
            })}
          </nav>
          <header className="border-b border-border/60 pb-6">
            <p className="mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {activePage === "overview"
                ? "Get Started"
                : activePage === "api"
                  ? "Reference"
                  : "Automation"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          </header>

          <div className="docs-content max-w-3xl py-8 space-y-10">{children}</div>
        </article>

        {sections && sections.length > 0 && (
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-6">
              <section>
                <p className="mono mb-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
                  On This Page
                </p>
                <nav className="space-y-1.5 text-sm">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="block text-muted-foreground hover:text-foreground transition"
                    >
                      {s.label}
                    </a>
                  ))}
                </nav>
              </section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-5">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function SubHeading({ children }: { children: string }) {
  return (
    <h4 className="mono text-xs uppercase tracking-widest text-muted-foreground/80">{children}</h4>
  );
}

export function CodeBlock({ label, children }: { label?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <button
        onClick={copy}
        className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {label && (
        <div className="border-b border-border/60 px-5 py-2.5">
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">
            {label}
          </p>
        </div>
      )}
      <pre className="overflow-x-auto px-5 py-4 text-sm leading-6">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function InfoBox({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning";
  title: string;
  children: ReactNode;
}) {
  const styles =
    variant === "info"
      ? "border-sky-500/20 bg-sky-500/[0.06]"
      : "border-amber-500/20 bg-amber-500/[0.07]";
  return (
    <div className={`rounded-xl border px-5 py-4 ${styles}`}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export function FieldTable({
  fields,
}: {
  fields: { name: string; type: string; notes: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="min-w-full divide-y divide-border/60 text-left text-sm">
        <thead className="bg-muted/10">
          <tr>
            <th className="px-5 py-3 font-medium text-foreground/80">Field</th>
            <th className="px-5 py-3 font-medium text-foreground/80">Type</th>
            <th className="px-5 py-3 font-medium text-foreground/80">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {fields.map((f) => (
            <tr key={f.name}>
              <td className="px-5 py-3 font-mono text-sm text-foreground/90">{f.name}</td>
              <td className="px-5 py-3 text-muted-foreground">{f.type}</td>
              <td className="px-5 py-3 text-muted-foreground">{f.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusCodeTable({ codes }: { codes: { status: string; meaning: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="min-w-full divide-y divide-border/60 text-left text-sm">
        <thead className="bg-muted/10">
          <tr>
            <th className="px-5 py-3 font-medium text-foreground/80">Status</th>
            <th className="px-5 py-3 font-medium text-foreground/80">Meaning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {codes.map((c) => (
            <tr key={c.status}>
              <td className="px-5 py-3 font-mono text-sm text-foreground/90">{c.status}</td>
              <td className="px-5 py-3 text-muted-foreground">{c.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TwoColCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-5">
      <p className="mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
