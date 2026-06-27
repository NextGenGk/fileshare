import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight, ipHash, fileResponse } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";
import { readFile } from "@/lib/storage.server";

export const Route = createFileRoute("/api/public/v1/claims/$code")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "download", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("download", rl.remaining, rl.reset) },
          );
        }
        const d = await prisma().drop.findFirst({
          where: { claimCode: params.code, deletedAt: null },
          select: {
            id: true,
            slug: true,
            originalName: true,
            contentType: true,
            expiresAt: true,
            maxDownloads: true,
            downloadCount: true,
            uploadCompletedAt: true,
          },
        });
        if (!d) return json({ error: "invalid_code" }, { status: 404 });
        if (!d.uploadCompletedAt) return json({ error: "incomplete" }, { status: 409 });
        if (new Date(d.expiresAt) < new Date()) return json({ error: "expired" }, { status: 410 });
        if (d.maxDownloads && d.downloadCount >= d.maxDownloads)
          return json({ error: "exhausted" }, { status: 410 });

        const buf = await readFile(d.id);

        await prisma().drop.update({ where: { id: d.id }, data: { claimCode: null } });
        await prisma().drop.update({
          where: { id: d.id },
          data: { downloadCount: { increment: 1 } },
        });
        await prisma().downloadEvent.create({
          data: {
            dropId: d.id,
            ipHash: ipHash(request),
            userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          },
        });

        return fileResponse(buf, d.contentType || "application/octet-stream", d.originalName);
      },
      GET: async ({ request, params }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "metadata", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("metadata", rl.remaining, rl.reset) },
          );
        }
        const d = await prisma().drop.findFirst({
          where: { claimCode: params.code, deletedAt: null },
          select: {
            slug: true,
            originalName: true,
            sizeBytes: true,
            contentType: true,
            expiresAt: true,
            maxDownloads: true,
            downloadCount: true,
            uploadCompletedAt: true,
          },
        });
        if (!d) return json({ error: "invalid_code" }, { status: 404 });
        if (!d.uploadCompletedAt) return json({ error: "incomplete" }, { status: 409 });
        if (new Date(d.expiresAt) < new Date()) return json({ error: "expired" }, { status: 410 });
        if (d.maxDownloads && d.downloadCount >= d.maxDownloads)
          return json({ error: "exhausted" }, { status: 410 });

        return json({
          ...rateLimitHeaders("metadata", rl.remaining, rl.reset),
          slug: d.slug,
          name: d.originalName,
          size: d.sizeBytes,
          contentType: d.contentType,
          expiresAt: d.expiresAt,
          maxDownloads: d.maxDownloads,
          downloadCount: d.downloadCount,
        });
      },
    },
  },
});
