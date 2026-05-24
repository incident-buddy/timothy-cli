import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app, { parseUploadRequest } from "./upload.js";

vi.mock("../lib/firebase.js", () => ({
  db: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("../lib/storage.js", () => ({
  uploadHtml: vi.fn().mockResolvedValue(undefined),
}));

import { db } from "../lib/firebase.js";
import { uploadHtml } from "../lib/storage.js";
import { now } from "../lib/time.js";

const mockUserId = "user-123";

function makeRequest(body: unknown) {
  return new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeWrapperApp() {
  const wrapper = new Hono<{ Variables: { userId: string } }>();
  wrapper.use("/*", async (c, next) => {
    c.set("userId", mockUserId);
    await next();
  });
  wrapper.route("/", app);
  return wrapper;
}

// For validation tests, userId is irrelevant — validation fails before it's used
function fetchDirect(req: Request) {
  return app.fetch(req);
}

describe("parseUploadRequest", () => {
  it("returns ok:true for valid input", () => {
    const result = parseUploadRequest({ html: "<h1>Hi</h1>", title: "T", description: "D", ttlDays: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ html: "<h1>Hi</h1>", title: "T", description: "D", ttlDays: 1 });
    }
  });

  it("returns ok:false when required fields are missing", () => {
    const result = parseUploadRequest({ html: "<h1>Hi</h1>" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Missing required fields/);
    }
  });

  it("returns ok:false when html is empty", () => {
    const result = parseUploadRequest({ html: "", title: "T", description: "D", ttlDays: 1 });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when title is empty", () => {
    const result = parseUploadRequest({ html: "<h1>Hi</h1>", title: "", description: "D", ttlDays: 1 });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when description is not a string", () => {
    const result = parseUploadRequest({ html: "<h1>Hi</h1>", title: "T", description: 123, ttlDays: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/description/);
    }
  });

  it("returns ok:false when ttlDays is not a positive integer", () => {
    const result = parseUploadRequest({ html: "<h1>Hi</h1>", title: "T", description: "D", ttlDays: -1 });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when ttlDays is a float", () => {
    const result = parseUploadRequest({ html: "<h1>Hi</h1>", title: "T", description: "D", ttlDays: 1.5 });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when body is null", () => {
    const result = parseUploadRequest(null);
    expect(result.ok).toBe(false);
  });
});

describe("POST /upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadHtml).mockResolvedValue(undefined);
    const docMock = { set: vi.fn().mockResolvedValue(undefined) };
    const collectionMock = { doc: vi.fn().mockReturnValue(docMock) };
    vi.mocked(db.collection).mockReturnValue(collectionMock as unknown as ReturnType<typeof db.collection>);
  });

  it("returns 400 when body is missing required fields", async () => {
    const res = await fetchDirect(makeRequest({ html: "<h1>Hello</h1>" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  it("returns 400 when html is empty string", async () => {
    const res = await fetchDirect(makeRequest({ html: "", title: "Test", description: "desc", ttlDays: 7 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty string", async () => {
    const res = await fetchDirect(makeRequest({ html: "<h1>Hello</h1>", title: "", description: "desc", ttlDays: 7 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is not a string", async () => {
    const res = await fetchDirect(makeRequest({ html: "<h1>Hello</h1>", title: "Test", description: 123, ttlDays: 7 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when ttlDays is not a positive integer", async () => {
    const res = await fetchDirect(makeRequest({ html: "<h1>Hi</h1>", title: "Test", description: "desc", ttlDays: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when ttlDays is a float", async () => {
    const res = await fetchDirect(makeRequest({ html: "<h1>Hi</h1>", title: "Test", description: "desc", ttlDays: 1.5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await fetchDirect(req);
    expect(res.status).toBe(400);
  });

  it("uploads to correct storage path and returns response on success", async () => {
    const validBody = { html: "<h1>Hello</h1>", title: "Monthly Report", description: "Details", ttlDays: 7 };
    const wrapper = makeWrapperApp();

    const res = await wrapper.fetch(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json() as { id: string; url: string; expiresAt: string };

    expect(json).toHaveProperty("id");
    expect(json.url).toMatch(/^https?:\/\/[^/]+\/s\//);
    expect(json).toHaveProperty("expiresAt");

    const expectedPath = `timothy-files/${mockUserId}/${json.id}.html`;
    expect(uploadHtml).toHaveBeenCalledWith(expectedPath, validBody.html);
    expect(db.collection).toHaveBeenCalledWith("htmlFiles");
  });

  it("saves correct metadata to Firestore", async () => {
    const validBody = { html: "<p>Content</p>", title: "Title", description: "Desc", ttlDays: 3 };

    const setMock = vi.fn().mockResolvedValue(undefined);
    const collectionMock = { doc: vi.fn().mockReturnValue({ set: setMock }) };
    vi.mocked(db.collection).mockReturnValue(collectionMock as unknown as ReturnType<typeof db.collection>);

    const wrapper = makeWrapperApp();
    const before = now();
    const res = await wrapper.fetch(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledOnce();

    const savedData = setMock.mock.calls[0][0] as Record<string, unknown>;
    expect(savedData.userId).toBe(mockUserId);
    expect(savedData.title).toBe(validBody.title);
    expect(savedData.description).toBe(validBody.description);
    expect(savedData.expiresAt).toBeInstanceOf(Date);
    expect(savedData.createdAt).toBeInstanceOf(Date);

    const expiresAt = savedData.expiresAt as Date;
    const diffDays = Math.round((expiresAt.getTime() - before.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(validBody.ttlDays);
  });

  it("returns 5xx when uploadHtml throws", async () => {
    vi.mocked(uploadHtml).mockRejectedValue(new Error("Storage error"));
    const wrapper = makeWrapperApp();
    const res = await wrapper.fetch(
      makeRequest({ html: "<h1>Hi</h1>", title: "T", description: "D", ttlDays: 1 })
    );
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it("returns 5xx when Firestore set throws", async () => {
    const setMock = vi.fn().mockRejectedValue(new Error("Firestore error"));
    const collectionMock = { doc: vi.fn().mockReturnValue({ set: setMock }) };
    vi.mocked(db.collection).mockReturnValue(collectionMock as unknown as ReturnType<typeof db.collection>);

    const wrapper = makeWrapperApp();
    const res = await wrapper.fetch(
      makeRequest({ html: "<h1>Hi</h1>", title: "T", description: "D", ttlDays: 1 })
    );
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});
