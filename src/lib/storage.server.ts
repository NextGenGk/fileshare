import { prisma } from "@/integrations/prisma/client.server";

export async function writeFile(dropId: string, data: ArrayBuffer | Buffer) {
  await prisma().drop.update({
    where: { id: dropId },
    data: { data: Buffer.from(data instanceof Buffer ? data : new Uint8Array(data)) },
  });
}

export async function readFile(dropId: string): Promise<Buffer> {
  const drop = await prisma().drop.findUnique({
    where: { id: dropId },
    select: { data: true },
  });
  if (!drop?.data) throw new Error("File data not found");
  return Buffer.from(drop.data);
}

export async function deleteFile(dropId: string) {
  await prisma().drop.update({
    where: { id: dropId },
    data: { data: null },
  });
}

export async function fileExists(dropId: string): Promise<boolean> {
  const drop = await prisma().drop.findUnique({
    where: { id: dropId },
    select: { data: true },
  });
  return drop?.data !== null && drop?.data !== undefined;
}

export async function fileSize(dropId: string): Promise<number> {
  const drop = await prisma().drop.findUnique({
    where: { id: dropId },
    select: { data: true },
  });
  if (!drop?.data) return 0;
  return Buffer.from(drop.data).length;
}
