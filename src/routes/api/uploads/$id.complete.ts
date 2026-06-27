import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";
import { fileExists, fileSize } from "@/lib/storage.server";

export const Route = createFileRoute("/api/uploads/$id/complete")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "upload", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("upload", rl.remaining, rl.reset) },
          );
        }

        const drop = await prisma().drop.findUnique({
          where: { id: params.id },
          select: { id: true, slug: true, ownerId: true, expiresAt: true },
        });
        if (!drop) return json({ error: "not_found" }, { status: 404 });
        if (drop.ownerId && drop.ownerId !== caller.userId)
          return json({ error: "forbidden" }, { status: 403 });

        let exists = await fileExists(drop.id);
        if (!exists) {
          await new Promise((r) => setTimeout(r, 600));
          exists = await fileExists(drop.id);
        }
        if (!exists) return json({ error: "upload_missing" }, { status: 400 });

        const realSize = await fileSize(drop.id);
        await prisma().drop.update({
          where: { id: drop.id },
          data: { uploadCompletedAt: new Date(), sizeBytes: realSize },
        });

        const origin = new URL(request.url).origin;
        return json({
          ...rateLimitHeaders("upload", rl.remaining, rl.reset),
          id: drop.id,
          slug: drop.slug,
          shareUrl: `${origin}/d/${drop.slug}`,
          expiresAt: drop.expiresAt,
        });
      },
    },
  },
});
