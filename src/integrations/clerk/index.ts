import { createClerkClient, verifyToken } from "@clerk/backend";

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function getAuthFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { userId: null };

  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) return { userId: null };

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      jwtKey: process.env.CLERK_JWT_KEY,
    });
    return { userId: payload.sub ?? null };
  } catch {
    return { userId: null };
  }
}
