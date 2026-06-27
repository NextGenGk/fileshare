import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { resolveCaller, json, corsPreflight, ipHash, fileResponse } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";
import { deleteFile, readFile } from "@/lib/storage.server";

export const Route = createFileRoute("/api/files/$slug")({
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
        let body: { password?: string } = {};
        try {
          body = await request.json();
        } catch {
          /* */
        }

        const d = await prisma().drop.findUnique({
          where: { slug: params.slug },
          select: {
            id: true,
            originalName: true,
            expiresAt: true,
            maxDownloads: true,
            downloadCount: true,
            passwordHash: true,
            claimCode: true,
            uploadCompletedAt: true,
            contentType: true,
          },
        });
        if (!d) return json({ error: "not_found" }, { status: 404 });
        if (!d.uploadCompletedAt) return json({ error: "incomplete" }, { status: 409 });
        if (new Date(d.expiresAt) < new Date()) return json({ error: "expired" }, { status: 410 });
        if (d.maxDownloads && d.downloadCount >= d.maxDownloads)
          return json({ error: "exhausted" }, { status: 410 });
        if (d.claimCode) return json({ error: "requires_claim" }, { status: 401 });
        if (d.passwordHash) {
          if (!body.password) return json({ error: "password_required" }, { status: 401 });
          const hash = createHash("sha256").update(body.password).digest("hex");
          if (hash !== d.passwordHash) return json({ error: "bad_password" }, { status: 401 });
        }

        const buf = await readFile(d.id);

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
        const d = await prisma().drop.findUnique({
          where: { slug: params.slug },
          select: {
            slug: true,
            originalName: true,
            sizeBytes: true,
            contentType: true,
            expiresAt: true,
            maxDownloads: true,
            downloadCount: true,
            passwordHash: true,
            claimCode: true,
            uploadCompletedAt: true,
          },
        });
        if (!d) return json({ error: "not_found" }, { status: 404 });
        if (!d.uploadCompletedAt) return json({ error: "incomplete" }, { status: 409 });
        const expired = new Date(d.expiresAt) < new Date();
        const remainingDownloads = d.maxDownloads
          ? Math.max(0, d.maxDownloads - d.downloadCount)
          : null;
        return json({
          ...rateLimitHeaders("metadata", rl.remaining, rl.reset),
          id: d.slug,
          filename: d.originalName,
          size: d.sizeBytes,
          contentType: d.contentType,
          expires: d.expiresAt,
          passwordRequired: !!d.passwordHash,
          downloads: d.downloadCount,
          maxDownloads: d.maxDownloads,
          remainingDownloads,
          expired,
        });
      },
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
        const d = await prisma().drop.findUnique({
          where: { slug: params.slug },
          select: { id: true, ownerId: true },
        });
        if (!d) return json({ error: "not_found" }, { status: 404 });
        if (d.ownerId !== caller.userId) return json({ error: "forbidden" }, { status: 403 });
        await deleteFile(d.id);
        await prisma().drop.update({ where: { id: d.id }, data: { deletedAt: new Date() } });
        return json({ ok: true, ...rateLimitHeaders("management", rl.remaining, rl.reset) });
      },
    },
  },
});
