import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useSignIn, useSignUp } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FileShare" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { isLoaded: siLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: suLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  if (isSignedIn) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!suLoaded || !signUp || !setActiveSignUp) throw new Error("Sign up not ready");
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === "complete") {
        await setActiveSignUp({ session: result.createdSessionId });
        toast.success("Account created. You're in.");
        navigate({ to: "/dashboard" });
      } else {
        await signUp.prepareEmailAddressVerification();
        setVerifying(true);
        toast.success("Verification code sent to your email.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!signUp || !setActiveSignUp) throw new Error("Sign up not ready");
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActiveSignUp({ session: signUp.createdSessionId });
        toast.success("Account created. You're in.");
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Invalid code. Try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      if (!signUp) throw new Error("Not ready");
      await signUp.prepareEmailAddressVerification();
      toast.success("Code resent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!siLoaded || !signIn || !setActiveSignIn) throw new Error("Sign in not ready");
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActiveSignIn({ session: result.createdSessionId });
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Sign in failed — check your credentials.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  if (verifying) {
    return (
      <div className="px-4 pt-24 pb-16 flex justify-center">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mono mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            we sent a code to {email}
          </p>

          <form onSubmit={handleVerify} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="code" className="mono text-xs uppercase tracking-widest">
                verification code
              </Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mono mt-1 text-center text-lg tracking-[0.3em]"
              />
            </div>
            <div id="clerk-captcha" />
            <Button type="submit" disabled={busy || code.length < 4} className="w-full">
              {busy ? "…" : "Verify email"}
            </Button>
          </form>

          <p className="mono mt-6 text-center text-xs text-muted-foreground">
            didn't get it?{" "}
            <button
              type="button"
              disabled={resending}
              onClick={handleResend}
              className="text-accent hover:underline"
            >
              resend
            </button>
          </p>

          <button
            type="button"
            onClick={() => setVerifying(false)}
            className="mono mt-4 inline-flex items-center text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-24 pb-16 flex justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">
          {mode === "sign_in" ? "Sign in" : "Create account"}
        </h1>
        <p className="mono mt-1 text-xs uppercase tracking-widest text-muted-foreground">
          anonymous uploads work without an account
        </p>

        {siLoaded && signIn && (
          <>
            <Button
              onClick={async () => {
                try {
                  await signIn.authenticateWithRedirect({
                    strategy: "oauth_google",
                    redirectUrl: window.location.origin,
                    redirectUrlComplete: window.location.origin + "/dashboard",
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Google sign-in failed");
                }
              }}
              variant="outline"
              className="mt-6 w-full"
            >
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
            <Button
              onClick={async () => {
                try {
                  await signIn.authenticateWithRedirect({
                    strategy: "oauth_github",
                    redirectUrl: window.location.origin,
                    redirectUrlComplete: window.location.origin + "/dashboard",
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "GitHub sign-in failed");
                }
              }}
              variant="outline"
              className="mt-2 w-full"
            >
              <svg
                viewBox="0 0 24 24"
                className="mr-2 h-4 w-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </Button>
          </>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="mono text-xs uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={mode === "sign_up" ? handleSignUp : handleSignIn} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mono text-xs uppercase tracking-widest">
              email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mono mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pw" className="mono text-xs uppercase tracking-widest">
              password
            </Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mono mt-1"
            />
          </div>
          <div id="clerk-captcha" />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "…" : mode === "sign_in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
          className="mono mt-6 text-xs uppercase tracking-widest text-muted-foreground hover:text-[#f97316] cursor-pointer"
        >
          {mode === "sign_in" ? "Need an account? Sign up →" : "← Already have an account?"}
        </button>
      </div>
    </div>
  );
}
