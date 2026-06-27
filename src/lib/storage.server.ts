import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { del, BlobNotFoundError } from "@vercel/blob";

const pn = (dropId: string) => `drops/${dropId}`;

export async function createUploadToken(
  dropId: string,
  contentType: string,
  size: number,
): Promise<string> {
  return generateClientTokenFromReadWriteToken({
    pathname: pn(dropId),
    allowedContentTypes: [contentType],
    maximumSizeInBytes: size,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: Date.now() + 2 * 60 * 60 * 1000,
  });
}

export async function deleteFile(dropId: string) {
  try {
    await del(pn(dropId));
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
}
