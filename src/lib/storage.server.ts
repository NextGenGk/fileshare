import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { head, del, BlobNotFoundError } from "@vercel/blob";

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

export async function createDownloadUrl(dropId: string): Promise<string> {
  const { issueSignedToken, presignUrl } = await import("@vercel/blob");
  const token = await issueSignedToken({
    pathname: pn(dropId),
    operations: ["get"],
    validUntil: Date.now() + 60 * 60 * 1000,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname: pn(dropId),
    access: "public",
  });
  return presignedUrl;
}

export async function deleteFile(dropId: string) {
  try {
    await del(pn(dropId));
  } catch (err) {
    if (!(err instanceof BlobNotFoundError)) throw err;
  }
}

async function headFallback(dropId: string): Promise<{ size: number } | null> {
  return null;
}

export async function fileExists(dropId: string): Promise<boolean> {
  try {
    await head(pn(dropId));
    return true;
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      const fb = await headFallback(dropId);
      return fb !== null;
    }
    throw err;
  }
}

export async function fileSize(dropId: string): Promise<number> {
  try {
    const blob = await head(pn(dropId));
    return blob.size;
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      const fb = await headFallback(dropId);
      if (fb) return fb.size;
    }
    throw err;
  }
}
