import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    return {};
  },
  component: AuthGuard,
});

function AuthGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate({ to: "/auth" });
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) return null;
  if (!isSignedIn) return null;
  return <Outlet />;
}
