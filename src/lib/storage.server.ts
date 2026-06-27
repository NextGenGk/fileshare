import { issueSignedToken, presignUrl, head, del, BlobNotFoundError } from "@vercel/blob";

const pn = (dropId: string) => `drops/${dropId}`;

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

export async function fileExists(dropId: string): Promise<boolean> {
  try {
    await head(pn(dropId));
    return true;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return false;
    throw err;
  }
}

export async function fileSize(dropId: string): Promise<number> {
  const blob = await head(pn(dropId));
  return blob.size;
}
