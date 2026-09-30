import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export class UploadError extends Error {}

export async function saveImageUpload(file: File): Promise<string> {
  if (!MIME_TO_EXT[file.type]) {
    throw new UploadError("Only PNG, JPEG, GIF, or WEBP images are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("Image must be 5MB or smaller");
  }

  const ext = MIME_TO_EXT[file.type];
  const filename = `chat-uploads/${randomUUID()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    contentType: file.type,
  });

  return blob.url;
}
