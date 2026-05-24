import type { Bucket } from "@google-cloud/storage";
import { storage } from "./firebase.js";

export function getBucket(): Bucket {
  return storage.bucket();
}

export async function uploadHtml(
  storagePath: string,
  html: string
): Promise<void> {
  const bucket = getBucket();
  const file = bucket.file(storagePath);
  await file.save(html, { contentType: "text/html; charset=utf-8" });
}

export async function getFileContent(storagePath: string): Promise<string> {
  const bucket = getBucket();
  const [contents] = await bucket.file(storagePath).download();
  return contents.toString("utf-8");
}

export async function deleteFile(storagePath: string): Promise<void> {
  const bucket = getBucket();
  await bucket.file(storagePath).delete();
}
