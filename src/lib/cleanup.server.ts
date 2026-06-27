import { prisma } from '@/integrations/prisma/client.server';
import { deleteFile } from '@/lib/storage.server';

let lastCleanup = 0;
const CLEANUP_INTERVAL = 60_000;

export async function performBackgroundCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  try {
    const maxAge = new Date(Date.now() - 30 * 86400_000);
    const expired = await prisma().drop.findMany({
      where: {
        deletedAt: null,
        OR: [
          { expiresAt: { lt: new Date() } },
          { createdAt: { lt: maxAge } },
          { ownerId: null, downloadCount: { gte: 1 } }
        ],
      },
      select: { id: true },
      take: 50, // Smaller chunks for background
    });

    if (!expired.length) return;

    for (const d of expired) {
      await deleteFile(d.id).catch(() => {});
    }

    const ids = expired.map((d) => d.id);
    await prisma().drop.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  } catch (err) {
    console.error('Background cleanup error:', err);
  }
}
