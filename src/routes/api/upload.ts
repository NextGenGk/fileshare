import { createFileRoute } from "@tanstack/react-router";
import { customAlphabet } from "nanoid";
import { randomInt } from "node:crypto";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
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
import { put } from "@vercel/blob";

const slugify = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

const DURATION_MAP: Record<string, number> = {
  "1h": 1,
  "24h": 1,
  "3d": 3,
  "7d": 7,
};

function parseDuration(value: string): number | null {
  return DURATION_MAP[value] ?? null;
}

function parseExpiresAt(value: string): number | null {
  const ms = Date.parse(value);
  if (isNaN(ms)) return null;
  const days = Math.ceil((ms - Date.now()) / 86400_000);
  if (days < 1 || days > MAX_EXPIRY_DAYS) return null;
  return days;
}

function generateClaimCode(): string {
  return String(randomInt(1_000, 9_999));
}

export const Route = createFileRoute("/api/upload")({
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

        const isWebClient = request.headers.get("x-fileshare-web") === "true";
        if (!caller.userId && !isWebClient) {
          return json({ error: "unauthorized", message: "API key is required for API and CLI uploads." }, { status: 401 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "invalid_form" }, { status: 400 });
        }

        const fileField = form.get("file");
        if (!fileField || !(fileField instanceof File)) {
          return json({ error: "file_required" }, { status: 400 });
        }

        const buf = await fileField.arrayBuffer();
        if (buf.byteLength > MAX_FILE_BYTES) {
          return json({ error: "file_too_large" }, { status: 413 });
        }

        const durationRaw = form.get("duration");
        const expiresAtRaw = form.get("expiresAt");
        let expiresInDays = DEFAULT_EXPIRY_DAYS;

        if (typeof durationRaw === "string" && durationRaw) {
          const d = parseDuration(durationRaw);
          if (d === null) return json({ error: "invalid_duration" }, { status: 400 });
          expiresInDays = d;
        } else if (typeof expiresAtRaw === "string" && expiresAtRaw) {
          const d = parseExpiresAt(expiresAtRaw);
          if (d === null) return json({ error: "invalid_expires_at" }, { status: 400 });
          expiresInDays = d;
        }

        const password =
          typeof form.get("password") === "string"
            ? (form.get("password") as string).trim()
            : undefined;
        const maxDownloadsRaw = form.get("maxDownloads");
        const maxDownloads =
          typeof maxDownloadsRaw === "string" && maxDownloadsRaw
            ? Math.max(1, Number(maxDownloadsRaw))
            : undefined;

        const slug = slugify();
        const id = crypto.randomUUID();

        const isAuth = !!caller.userId;
        const msTillExpiry = isAuth
          ? expiresInDays * 86400_000
          : 5 * 60_000; // 5 minutes for unauthenticated
        const expiresAt = new Date(Date.now() + msTillExpiry);

        const passwordHash = password ? createHash("sha256").update(password).digest("hex") : null;

        // Upload to Vercel Blob
        let blobUrl: string;
        try {
          const blob = await put(`drops/${id}`, new Blob([buf], { type: fileField.type || "application/octet-stream" }), {
            access: "public",
            contentType: fileField.type || "application/octet-stream",
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          blobUrl = blob.url;
        } catch (e) {
          return json({ error: "blob_error", message: String(e) }, { status: 500 });
        }

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prisma().drop.create({
              data: {
                id,
                slug,
                ownerId: caller.userId,
                originalName: fileField.name,
                sizeBytes: buf.byteLength,
                contentType: fileField.type || null,
                passwordHash,
                maxDownloads: maxDownloads ?? null,
                expiresAt,
                uploadCompletedAt: new Date(),
                blobUrl,
              },
            });
            break;
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002" &&
              attempt < 2
            ) {
              continue;
            }
            return json({ error: "db_error", message: String(err) }, { status: 500 });
          }
        }

        const origin = new URL(request.url).origin;
        return json(
          {
            id: slug,
            url: `${origin}/d/${slug}`,
            expires: expiresAt.toISOString(),
            downloads: 0,
            maxDownloads: maxDownloads ?? null,
            passwordRequired: !!password,
            filename: fileField.name,
            size: buf.byteLength,
          },
          { headers: rateLimitHeaders("upload", rl.remaining, rl.reset) },
        );
      },
    },
  },
});
