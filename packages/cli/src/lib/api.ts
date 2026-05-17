import type { Config } from "./config.js";

export type UploadPayload = {
  html: string;
  title: string;
  description: string;
  ttlDays: number;
};

export type UploadResponse = {
  id: string;
  url: string;
  expiresAt: string;
};

export type FileEntry = {
  id: string;
  title: string;
  createdAt: string;
  expiresAt: string;
};

function authHeaders(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
  }
}

export async function apiUpload(payload: UploadPayload, config: Config): Promise<UploadResponse> {
  const res = await fetch(`${config.apiEndpoint}/upload`, {
    method: "POST",
    headers: authHeaders(config.apiKey),
    body: JSON.stringify(payload),
  });
  await assertOk(res);
  return res.json() as Promise<UploadResponse>;
}

export async function apiList(config: Config): Promise<FileEntry[]> {
  const res = await fetch(`${config.apiEndpoint}/files`, {
    headers: authHeaders(config.apiKey),
  });
  await assertOk(res);
  return res.json() as Promise<FileEntry[]>;
}

export async function apiDelete(id: string, config: Config): Promise<void> {
  const res = await fetch(`${config.apiEndpoint}/files/${id}`, {
    method: "DELETE",
    headers: authHeaders(config.apiKey),
  });
  await assertOk(res);
}
