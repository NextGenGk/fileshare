import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";

export const Route = createFileRoute("/api/public/v1/me/drops")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
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
        const rows = await prisma().drop.findMany({
          where: { ownerId: caller.userId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            slug: true,
            originalName: true,
            sizeBytes: true,
            expiresAt: true,
            downloadCount: true,
            maxDownloads: true,
            createdAt: true,
            uploadCompletedAt: true,
          },
        });
        const origin = new URL(request.url).origin;
        return json({
          ...rateLimitHeaders("management", rl.remaining, rl.reset),
          drops: rows.map((d) => ({
            slug: d.slug,
            name: d.originalName,
            size: d.sizeBytes,
            expiresAt: d.expiresAt,
            downloads: d.downloadCount,
            maxDownloads: d.maxDownloads,
            createdAt: d.createdAt,
            ready: !!d.uploadCompletedAt,
            shareUrl: `${origin}/d/${d.slug}`,
          })),
        });
      },
    },
  },
});
