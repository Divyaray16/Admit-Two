import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { StoreError, attachAudio, createInvitation, getManaged, getPublic, readAudio, respond } from "./store.ts";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-length", Buffer.byteLength(payload));
  res.end(payload);
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
      req.destroy();
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        fail(new StoreError(413, "That recording is too large. Try a shorter message."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", () => fail(new StoreError(400, "The invitation couldn’t be read.")));
  });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req, 4_000_000);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString("utf8")) as unknown;
  } catch {
    throw new StoreError(400, "The invitation couldn’t be read.");
  }
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function serveAudio(req: IncomingMessage, res: ServerResponse, bytes: Buffer, mime: string): void {
  res.setHeader("content-type", mime);
  res.setHeader("accept-ranges", "bytes");
  res.setHeader("cache-control", "private, max-age=0, must-revalidate");
  res.setHeader("x-content-type-options", "nosniff");
  const range = header(req, "range");
  const total = bytes.length;
  if (!range) {
    res.statusCode = 200;
    res.setHeader("content-length", total);
    res.end(bytes);
    return;
  }
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) {
    res.statusCode = 416;
    res.setHeader("content-range", `bytes */${total}`);
    res.end();
    return;
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start >= total || end < start || end >= total) {
    res.statusCode = 416;
    res.setHeader("content-range", `bytes */${total}`);
    res.end();
    return;
  }
  const slice = bytes.subarray(start, end + 1);
  res.statusCode = 206;
  res.setHeader("content-range", `bytes ${start}-${end}/${total}`);
  res.setHeader("content-length", slice.length);
  res.end(slice);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (!pathname.startsWith("/api/")) return false;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, backend: "server" });
    return true;
  }

  const audioRoute = /^\/api\/audio\/([^/]+)$/.exec(pathname);
  if (audioRoute && req.method === "GET") {
    const file = await readAudio(decodePart(audioRoute[1] ?? ""));
    if (!file) {
      sendJson(res, 404, { error: "This recording can’t be found." });
      return true;
    }
    serveAudio(req, res, file.bytes, file.mime);
    return true;
  }

  const invitationRoute = /^\/api\/invitations(?:\/([^/]+)(?:\/(rsvp|audio|manage))?)?$/.exec(pathname);
  if (!invitationRoute) {
    sendJson(res, 404, { error: "Not found." });
    return true;
  }

  const publicId = invitationRoute[1] ? decodePart(invitationRoute[1]) : "";
  const action = invitationRoute[2] ?? "";

  if (!publicId && req.method === "POST") {
    const created = await createInvitation(await readJson(req));
    sendJson(res, 201, created);
    return true;
  }

  if (publicId && !action && req.method === "GET") {
    const invitation = await getPublic(publicId);
    if (!invitation) {
      sendJson(res, 404, { error: "This invitation can’t be found." });
      return true;
    }
    sendJson(res, 200, invitation);
    return true;
  }

  if (publicId && action === "rsvp" && req.method === "POST") {
    const body = await readJson(req);
    const status = isStatusBody(body) ? body.status : undefined;
    sendJson(res, 200, await respond(publicId, status));
    return true;
  }

  if (publicId && action === "audio" && req.method === "POST") {
    const token = header(req, "x-manage-token");
    sendJson(res, 200, await attachAudio(publicId, token, await readJson(req)));
    return true;
  }

  if (publicId && action === "manage" && req.method === "GET") {
    const invitation = await getManaged(publicId, header(req, "x-manage-token"));
    if (!invitation) {
      sendJson(res, 404, { error: "This invitation can’t be found." });
      return true;
    }
    sendJson(res, 200, invitation);
    return true;
  }

  sendJson(res, 405, { error: "That request isn’t supported." });
  return true;
}

function isStatusBody(value: unknown): value is { status: unknown } {
  return value != null && typeof value === "object" && "status" in value;
}

function attach(middlewares: Connect.Server): void {
  middlewares.use((req, res, next) => {
    void handle(req, res)
      .then((handled) => {
        if (!handled) next();
      })
      .catch((error: unknown) => {
        if (res.headersSent) return;
        if (error instanceof StoreError) {
          sendJson(res, error.status, { error: error.message });
          return;
        }
        console.error(error);
        sendJson(res, 500, { error: "The invitation couldn’t be saved." });
      });
  });
}

export function invitationApi(): Plugin {
  return {
    name: "admittwo-invitation-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
