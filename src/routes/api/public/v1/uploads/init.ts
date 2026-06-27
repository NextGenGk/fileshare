import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { randomInt } from "node:crypto";
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
import { createHash } from "node:crypto";
import { prisma } from "@/integrations/prisma/client.server";
import { createUploadToken } from "@/lib/storage.server";

const slugify = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

const Body = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  contentType: z.string().max(200).optional(),
  deliveryMode: z.enum(["link", "password", "otp"]).optional().default("link"),
  password: z.string().min(1).max(200).optional(),
  expiresInDays: z.number().int().min(1).max(MAX_EXPIRY_DAYS).optional(),
  maxDownloads: z.number().int().positive().optional(),
});

function generateClaimCode(): string {
  return String(randomInt(1_000, 9_999));
}

export const Route = createFileRoute("/api/public/v1/uploads/init")({
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
        const parsed = Body.safeParse(body);
        if (!parsed.success)
          return json({ error: "invalid_input", details: parsed.error.flatten() }, { status: 400 });

        if (parsed.data.deliveryMode === "password" && !parsed.data.password)
          return json({ error: "password_required_for_mode" }, { status: 400 });

        const slug = slugify();
        const id = crypto.randomUUID();
        const expiresAt = new Date(
          Date.now() + (parsed.data.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 86400_000,
        ).toISOString();

        const passwordHash = parsed.data.password
          ? createHash("sha256").update(parsed.data.password).digest("hex")
          : null;

        let claimCode: string | null = null;
        if (parsed.data.deliveryMode === "otp") {
          claimCode = generateClaimCode();
        }

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prisma().drop.create({
              data: {
                id,
                slug,
                ownerId: caller.userId,
                originalName: parsed.data.filename,
                sizeBytes: parsed.data.size,
                contentType: parsed.data.contentType ?? null,
                passwordHash,
                claimCode,
                maxDownloads: parsed.data.maxDownloads ?? null,
                expiresAt: new Date(expiresAt),
              },
            });
            break;
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002" &&
              Array.isArray((err.meta as any)?.target) &&
              (err.meta as any).target.includes("claim_code") &&
              attempt < 2
            ) {
              claimCode = generateClaimCode();
              continue;
            }
            return json({ error: "db_error", message: String(err) }, { status: 500 });
          }
        }

        let uploadToken: string;
        try {
          uploadToken = await createUploadToken(
            id,
            parsed.data.contentType || "application/octet-stream",
            parsed.data.size,
          );
        } catch (err) {
          return json({ error: "storage_error", message: String(err) }, { status: 500 });
        }
        const origin = new URL(request.url).origin;
        return json(
          {
            id,
            slug,
            deliveryMode: parsed.data.deliveryMode,
            claimCode,
            uploadToken,
            shareUrl: `${origin}/d/${slug}`,
            expiresAt,
          },
          { headers: rateLimitHeaders("upload", rl.remaining, rl.reset) },
        );
      },
    },
  },
});
