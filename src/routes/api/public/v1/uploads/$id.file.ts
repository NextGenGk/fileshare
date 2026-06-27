import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { prisma } from "@/integrations/prisma/client.server";
import { writeFile } from "@/lib/storage.server";

export const Route = createFileRoute("/api/public/v1/uploads/$id/file")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      PUT: async ({ request, params }) => {
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
          select: { id: true },
        });
        if (!drop) return json({ error: "not_found" }, { status: 404 });

        const buf = await request.arrayBuffer();
        await writeFile(drop.id, buf);

        return new Response(null, { status: 200 });
      },
    },
  },
});
