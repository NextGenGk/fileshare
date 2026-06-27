import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";

export const Route = createFileRoute("/api/public/v1/uploads/$id/complete")({
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

        let blobUrl: string | undefined;
        try {
          const body = await request.json();
          blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : undefined;
        } catch { /* optional body */ }

        const drop = await prisma().drop.findUnique({
          where: { id: params.id },
          select: { id: true, slug: true, ownerId: true, expiresAt: true },
        });
        if (!drop) return json({ error: "not_found" }, { status: 404 });
        if (drop.ownerId && drop.ownerId !== caller.userId)
          return json({ error: "forbidden" }, { status: 403 });

        if (!blobUrl) {
          return json({ error: "blob_url_missing" }, { status: 400 });
        }

        await prisma().drop.update({
          where: { id: drop.id },
          data: { uploadCompletedAt: new Date(), blobUrl },
        });

        const origin = new URL(request.url).origin;
        return json(
          {
            id: drop.id,
            slug: drop.slug,
            shareUrl: `${origin}/d/${drop.slug}`,
            expiresAt: drop.expiresAt,
          },
          { headers: rateLimitHeaders("upload", rl.remaining, rl.reset) },
        );
      },
    },
  },
});
