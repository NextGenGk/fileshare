import { createFileRoute } from "@tanstack/react-router";
import { resolveCaller, json, corsPreflight } from "@/lib/api-auth.server";
import { checkRateLimit, rateLimitHeaders, sweepExpired } from "@/lib/rate-limit.server";
import { MAX_EXPIRY_DAYS, MAX_FILE_BYTES } from "@/lib/constants";

export const Route = createFileRoute("/api/cli/config")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        sweepExpired();
        const caller = await resolveCaller(request);
        const rl = checkRateLimit(request, "config", caller.userId, caller.apiKeyId);
        if (!rl.allowed) {
          return json(
            { error: "rate_limited" },
            { status: 429, headers: rateLimitHeaders("config", rl.remaining, rl.reset) },
          );
        }
        return json({
          ...rateLimitHeaders("config", rl.remaining, rl.reset),
          maxExpiryDays: MAX_EXPIRY_DAYS,
          maxFileBytes: MAX_FILE_BYTES,
          defaultDuration: "24h",
          durationOptions: ["1h", "24h", "3d", "7d"],
          maxRecipients: 0,
          inlineUpload: true,
          directUpload: false,
        });
      },
    },
  },
});
