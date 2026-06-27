import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";

export const Route = createFileRoute("/api/public/v1/me/keys/$id")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      DELETE: async ({ request, params }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "management", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("management", rl.remaining, rl.reset) },
          );
        }
        if (!caller.userId) return json({ error: "unauthorized" }, { status: 401 });
        await prisma().apiKey.updateMany({
          where: { id: params.id, userId: caller.userId },
          data: { revokedAt: new Date() },
        });
        return json({ ok: true, ...rateLimitHeaders("management", rl.remaining, rl.reset) });
      },
    },
  },
});
