import { createFileRoute } from "@tanstack/react-router";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { resolveCaller, json, corsPreflight, hashApiKey } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { API_KEY_PREFIX } from "@/lib/constants";
import { prisma } from "@/integrations/prisma/client.server";

const tokenGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", 36);

export const Route = createFileRoute("/api/public/v1/me/keys")({
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
        const keys = await prisma().apiKey.findMany({
          where: { userId: caller.userId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            createdAt: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        });
        return json(
          {
            keys: keys.map((k) => ({
              id: k.id,
              name: k.name,
              key_prefix: k.keyPrefix,
              created_at: k.createdAt,
              last_used_at: k.lastUsedAt,
              revoked_at: k.revokedAt,
            })),
          },
          { headers: rateLimitHeaders("management", rl.remaining, rl.reset) },
        );
      },
      POST: async ({ request }) => {
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
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          /* */
        }
        const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse(body);
        if (!parsed.success) return json({ error: "invalid_input" }, { status: 400 });
        const plain = `${API_KEY_PREFIX}${tokenGen()}`;
        const prefix = plain.slice(0, 10);
        const hash = hashApiKey(plain);
        const created = await prisma().apiKey.create({
          data: { userId: caller.userId, name: parsed.data.name, keyPrefix: prefix, keyHash: hash },
          select: { id: true, name: true, keyPrefix: true, createdAt: true },
        });
        return json(
          {
            key: {
              id: created.id,
              name: created.name,
              key_prefix: created.keyPrefix,
              created_at: created.createdAt,
            },
            token: plain,
          },
          { headers: rateLimitHeaders("management", rl.remaining, rl.reset) },
        );
      },
    },
  },
});
