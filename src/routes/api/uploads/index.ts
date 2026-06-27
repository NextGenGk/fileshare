import { createFileRoute } from "@tanstack/react-router";
import { customAlphabet } from "nanoid";
import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import {
  DEFAULT_EXPIRY_DAYS,
  MAX_EXPIRY_DAYS,
  MAX_FILE_BYTES,
  SLUG_ALPHABET,
  SLUG_LENGTH,
} from "@/lib/constants";
import { prisma } from "@/integrations/prisma/client.server";
import { createUploadToken } from "@/lib/storage.server";

const slugify = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

function generateClaimCode(): string {
  return String(randomInt(1_000, 9_999));
}

export const Route = createFileRoute("/api/uploads/")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "upload", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("upload", rl.remaining, rl.reset) },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, { status: 400 });
        }

        const filename = (body as any)?.filename;
        const contentType = (body as any)?.contentType;
        const size = (body as any)?.size;
        const duration = (body as any)?.duration;
        const expiresAtInput = (body as any)?.expiresAt;
        const password = (body as any)?.password;
        const maxDownloads = (body as any)?.maxDownloads;
        const notifyEmails = (body as any)?.notifyEmails;

        if (!filename || typeof filename !== "string")
          return json({ error: "filename_required" }, { status: 400 });
        if (!size || typeof size !== "number")
          return json({ error: "size_required" }, { status: 400 });
        if (size > MAX_FILE_BYTES) return json({ error: "file_too_large" }, { status: 413 });

        const DURATION_MAP: Record<string, number> = { "1h": 1, "24h": 1, "3d": 3, "7d": 7 };
        let expiresInDays = DEFAULT_EXPIRY_DAYS;

        if (typeof duration === "string" && duration) {
          const d = DURATION_MAP[duration];
          if (!d) return json({ error: "invalid_duration" }, { status: 400 });
          expiresInDays = d;
        } else if (typeof expiresAtInput === "string" && expiresAtInput) {
          const ms = Date.parse(expiresAtInput);
          if (isNaN(ms)) return json({ error: "invalid_expires_at" }, { status: 400 });
          const days = Math.ceil((ms - Date.now()) / 86400_000);
          if (days < 1 || days > MAX_EXPIRY_DAYS)
            return json({ error: "expires_at_out_of_range" }, { status: 400 });
          expiresInDays = days;
        }

        if (typeof password === "string" && password && !password.trim())
          return json({ error: "password_required" }, { status: 400 });

        const slug = slugify();
        const id = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + expiresInDays * 86400_000);

        const deliveryMode = password ? "password" : "link";
        const passwordHash = password ? createHash("sha256").update(password).digest("hex") : null;
        const maxDl =
          typeof maxDownloads === "number"
            ? Math.max(1, maxDownloads)
            : typeof maxDownloads === "string"
              ? Math.max(1, Number(maxDownloads))
              : undefined;

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prisma().drop.create({
              data: {
                id,
                slug,
                ownerId: caller.userId,
                originalName: filename,
                sizeBytes: size,
                contentType: contentType || null,
                passwordHash,
                maxDownloads: maxDl ?? null,
                expiresAt,
              },
            });
            break;
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002" &&
              attempt < 2
            )
              continue;
            return json({ error: "db_error", message: String(err) }, { status: 500 });
          }
        }

        let uploadToken: string;
        try {
          uploadToken = await createUploadToken(
            id,
            contentType || "application/octet-stream",
            size,
          );
        } catch (err) {
          return json({ error: "storage_error", message: String(err) }, { status: 500 });
        }
        const origin = new URL(request.url).origin;
        return json({
          uploadId: id,
          shareId: slug,
          url: `${origin}/d/${slug}`,
          expiresAt: expiresAt.toISOString(),
          uploadToken,
          deliveryMode,
          passwordRequired: !!password,
          maxDownloads: maxDl ?? null,
        });
      },
    },
  },
});
