import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/v1/qr")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "config", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("config", rl.remaining, rl.reset) },
          );
        }
        const url = new URL(request.url).searchParams.get("url");
        if (!url) return new Response("missing url", { status: 400 });

        const QRCode = await import("qrcode");
        const buf = await QRCode.toBuffer(url, { width: 256, margin: 1 });

        return new Response(new Uint8Array(buf), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
