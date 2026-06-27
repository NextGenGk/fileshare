import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { Logo } from "@/components/logo";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FileShare — send big files, fast" },
      {
        name: "description",
        content:
          "Drop a file, share a link. Up to 2GB, expires automatically. Web UI, REST API, and CLI.",
      },
      { name: "author", content: "FileShare" },
      { property: "og:title", content: "FileShare — send big files, fast" },
      {
        property: "og:description",
        content: "Drop a file, share a link. Up to 2GB, expires automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-hidden">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ClerkAuthGate({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) return null;
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const publishableKey =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    "pk_test_dGhvcm91Z2gtZmluY2gtODcuY2xlcmsuYWNjb3VudHMuZGV2JA";

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <QueryClientProvider client={queryClient}>
        <ClerkAuthGate>
          <div className="min-h-screen max-w-[100vw] overflow-x-hidden">
            <SiteHeader />
            <main className="min-h-[calc(100vh-4rem)]">
              <Outlet />
            </main>
            <footer className="border-t border-border/40">
              <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
                <Link to="/" className="text-muted-foreground">
                  <Logo />
                </Link>
                <nav className="mono flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <Link to="/docs" className="hover:text-foreground">
                    Docs
                  </Link>
                  <Link to="/receive" className="hover:text-foreground">
                    Receive
                  </Link>
                  <a
                    href="https://github.com/anomalyco/fileshare"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    GitHub
                  </a>
                </nav>
                <p className="mono text-xs text-muted-foreground/60">
                  &copy; {new Date().getFullYear()} fileshare &mdash; all rights reserved
                </p>
              </div>
            </footer>
            <Toaster richColors closeButton position="top-right" />
          </div>
        </ClerkAuthGate>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function SiteHeader() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const qc = useQueryClient();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden md:flex flex-1 items-center justify-center gap-6 mono text-xs uppercase tracking-widest text-muted-foreground">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-foreground" }}
            className="hover:text-foreground"
          >
            Send
          </Link>
          <Link
            to="/receive"
            activeProps={{ className: "text-foreground" }}
            className="hover:text-foreground"
          >
            Receive
          </Link>
          <Link
            to="/docs"
            activeProps={{ className: "text-foreground" }}
            className="hover:text-foreground"
          >
            Docs
          </Link>
          {isLoaded && isSignedIn && (
            <Link
              to="/dashboard"
              activeProps={{ className: "text-foreground" }}
              className="hover:text-foreground"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="hidden md:flex shrink-0 items-center gap-2">
          {isLoaded && isSignedIn ? (
            <button
              type="button"
              onClick={() => {
                qc.clear();
                signOut();
                window.location.href = "/auth";
              }}
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent mono uppercase tracking-widest cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <>
              <Link
                to="/auth"
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 mono uppercase tracking-widest"
              >
                Get started
              </Link>
              <Link
                to="/auth"
                className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-[#f97316] hover:text-white mono uppercase tracking-widest cursor-pointer"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <Sheet>
          <SheetTrigger asChild className="md:hidden ml-auto">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/10 transition cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] sm:w-[320px]">
            <SheetHeader className="text-left">
              <SheetTitle>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-1">
              <SheetClose asChild>
                <Link
                  to="/"
                  activeOptions={{ exact: true }}
                  className="flex rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 transition"
                >
                  Send
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  to="/receive"
                  className="flex rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 transition"
                >
                  Receive
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  to="/docs"
                  className="flex rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 transition"
                >
                  Docs
                </Link>
              </SheetClose>
              {isLoaded && isSignedIn && (
                <SheetClose asChild>
                  <Link
                    to="/dashboard"
                    className="flex rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 transition"
                  >
                    Dashboard
                  </Link>
                </SheetClose>
              )}
            </nav>
            <div className="mt-6 border-t border-border/60 pt-6 space-y-2">
              {isLoaded && isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    qc.clear();
                    signOut();
                    window.location.href = "/auth";
                  }}
                  className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent mono uppercase tracking-widest cursor-pointer transition"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <SheetClose asChild>
                    <Link
                      to="/auth"
                      className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 mono uppercase tracking-widest transition"
                    >
                      Get started
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      to="/auth"
                      className="flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent mono uppercase tracking-widest transition"
                    >
                      Sign in
                    </Link>
                  </SheetClose>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
