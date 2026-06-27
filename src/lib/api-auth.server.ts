import { createHash } from "node:crypto";
import { verifyToken } from "@clerk/backend";
import { prisma } from "@/integrations/prisma/client.server";

export type Caller = {
  userId: string | null;
  apiKeyId: string | null;
};

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export async function resolveCaller(request: Request): Promise<Caller> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { userId: null, apiKeyId: null };
  }
  const token = auth.slice(7).trim();
  if (!token) return { userId: null, apiKeyId: null };

  // API key path
  if (token.startsWith("dlv_")) {
    const hash = hashApiKey(token);
    const key = await prisma().apiKey.findUnique({
      where: { keyHash: hash },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!key || key.revokedAt) return { userId: null, apiKeyId: null };
    await prisma().apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return { userId: key.userId, apiKeyId: key.id };
  }

  // Clerk JWT path
  if (token.split(".").length === 3) {
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
        jwtKey: process.env.CLERK_JWT_KEY,
      });
      if (payload.sub) return { userId: payload.sub, apiKeyId: null };
    } catch {
      /* */
    }
  }
  return { userId: null, apiKeyId: null };
}

export function ipHash(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function fileResponse(buf: Buffer, contentType: string, filename: string): Response {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
      "Content-Length": String(buf.length),
      ...CORS_HEADERS,
    },
  });
}
