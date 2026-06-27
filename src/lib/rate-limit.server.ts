import { createHash } from "node:crypto";

export type RateLimitTier = "anonymous" | "api_key" | "authenticated";

export type RateLimitAction = "upload" | "download" | "metadata" | "management" | "config";

const TIER_LIMITS: Record<
  RateLimitTier,
  Record<RateLimitAction, { window: number; max: number }>
> = {
  anonymous: {
    upload: { window: 60_000, max: 5 },
    download: { window: 60_000, max: 20 },
    metadata: { window: 60_000, max: 30 },
    management: { window: 60_000, max: 10 },
    config: { window: 60_000, max: 60 },
  },
  api_key: {
    upload: { window: 60_000, max: 60 },
    download: { window: 60_000, max: 200 },
    metadata: { window: 60_000, max: 300 },
    management: { window: 60_000, max: 100 },
    config: { window: 60_000, max: 600 },
  },
  authenticated: {
    upload: { window: 60_000, max: 60 },
    download: { window: 60_000, max: 200 },
    metadata: { window: 60_000, max: 300 },
    management: { window: 60_000, max: 100 },
    config: { window: 60_000, max: 600 },
  },
};

const buckets = new Map<string, number[]>();

function key(request: Request, userId: string | null, apiKeyId: string | null): string {
  const raw = apiKeyId
    ? `ak:${apiKeyId}`
    : userId
      ? `u:${userId}`
      : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("cf-connecting-ip") ||
        "unknown";
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export function checkRateLimit(
  request: Request,
  action: RateLimitAction,
  userId: string | null,
  apiKeyId: string | null,
): { allowed: boolean; remaining: number; reset: number } {
  const tier: RateLimitTier = apiKeyId ? "api_key" : userId ? "authenticated" : "anonymous";
  const { window: windowMs, max } = TIER_LIMITS[tier][action];
  const k = key(request, userId, apiKeyId);
  const now = Date.now();

  let timestamps = buckets.get(k) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  const reset = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

  if (timestamps.length >= max) {
    buckets.set(k, timestamps);
    return { allowed: false, remaining: 0, reset };
  }

  timestamps.push(now);
  buckets.set(k, timestamps);
  return { allowed: true, remaining: max - timestamps.length, reset };
}

export function rateLimitHeaders(
  action: RateLimitAction,
  remaining: number,
  reset: number,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(TIER_LIMITS.anonymous[action].max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
  };
}

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = 0;

export function sweepExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [k, timestamps] of buckets) {
    const fresh = timestamps.filter((t) => now - t < 60_000);
    if (fresh.length === 0) buckets.delete(k);
    else buckets.set(k, fresh);
  }
}
