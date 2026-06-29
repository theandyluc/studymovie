// TIP-012 — Vercel serverless entry cho Hono (Node runtime).
// TIP-013 FIX — Adapter @hono/node-server/vercel deadlock ở `Readable.toWeb(incoming)`
//   khi đọc body request thật của SePay (verify key OK rồi treo tại đọc body, timeout 300s).
//   Né bằng cách TỰ buffer raw body ở tầng Node (for await chủ động kéo stream) rồi gán
//   `req.rawBody` → adapter dùng fast-path (enqueue Buffer 1 lần) thay vì toWeb (kẹt backpressure).
//   Sửa CHỈ file entry này; src/index.ts (dev) giữ nguyên; không đổi runtime/env.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Http2ServerRequest, Http2ServerResponse } from "node:http2";
import { handle } from "@hono/node-server/vercel";
import { app } from "../src/app.js";

// Không để Vercel tự parse body — Hono đọc raw request.
export const config = { api: { bodyParser: false } };

const honoHandler = handle(app);

type Incoming = IncomingMessage | Http2ServerRequest;
type Outgoing = ServerResponse | Http2ServerResponse;

export default async function handler(req: Incoming, res: Outgoing): Promise<void> {
  const method = req.method ?? "GET";
  const r = req as Incoming & { rawBody?: Buffer };
  // Chỉ buffer khi có body (POST/PATCH/PUT/DELETE) và chưa có sẵn rawBody.
  if (method !== "GET" && method !== "HEAD" && !r.rawBody) {
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    r.rawBody = Buffer.concat(chunks); // body rỗng -> Buffer rỗng (không treo, không vỡ)
  }
  return honoHandler(req, res);
}
