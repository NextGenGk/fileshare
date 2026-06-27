import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";
import { deleteFile } from "@/lib/storage.server";

export const Route = createFileRoute("/api/public/cron/cleanup")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "config", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("config", rl.remaining, rl.reset) },
          );
        }
        const now = new Date();
        const maxAge = new Date(Date.now() - 30 * 86400_000);
        const expired = await prisma().drop.findMany({
          where: {
            deletedAt: null,
            OR: [{ expiresAt: { lt: now } }, { createdAt: { lt: maxAge } }],
          },
          select: { id: true },
          take: 500,
        });
        if (!expired.length)
          return json(
            { deleted: 0 },
            { headers: rateLimitHeaders("config", rl.remaining, rl.reset) },
          );
        for (const d of expired) {
          await deleteFile(d.id);
        }
        const ids = expired.map((d) => d.id);
        await prisma().drop.updateMany({
          where: { id: { in: ids } },
          data: { deletedAt: now },
        });
        return json(
          {
            deleted: expired.length,
          },
          { headers: rateLimitHeaders("config", rl.remaining, rl.reset) },
        );
      },
    },
  },
});
