import { issueSignedToken, presignUrl, head, del, BlobNotFoundError } from "@vercel/blob";

const pn = (dropId: string) => `drops/${dropId}`;

function blobToken(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error("BLOB_READ_WRITE_TOKEN not set");
  return t;
}

function storeId(): string {
  const parts = blobToken().split("_");
  const sid = parts.length >= 4 ? parts[3] : parts[parts.length - 1];
  return sid.startsWith("store_") ? sid.slice(6) : sid;
}

function cdnUrl(dropId: string): string {
  return `https://${storeId()}.public.blob.vercel-storage.com/${pn(dropId)}`;
}

export async function createUploadUrl(
  dropId: string,
  contentType: string,
  size: number,
): Promise<string> {
  const token = await issueSignedToken({
    pathname: pn(dropId),
    operations: ["put"],
    maximumSizeInBytes: size,
    allowedContentTypes: [contentType],
    validUntil: Date.now() + 2 * 60 * 60 * 1000,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "put",
    pathname: pn(dropId),
    access: "public",
    maximumSizeInBytes: size,
    allowedContentTypes: [contentType],
  });
  return presignedUrl;
}

export async function createDownloadUrl(dropId: string): Promise<string> {
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
  try {
    const url = cdnUrl(dropId);
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return null;
    const size = parseInt(res.headers.get("content-length") || "0", 10);
    return { size };
  } catch {
    return null;
  }
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
