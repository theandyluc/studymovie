// TIP-012 — Vercel serverless entry cho Hono (Node runtime).
// Adapter @hono/node-server/vercel -> handler (req,res) cho Vercel Functions.
// Local dev VẪN dùng src/index.ts (@hono/node-server serve) — file này CHỈ cho Vercel.
// vercel.json rewrite mọi path về /api để Hono tự định tuyến (/health, /api/*).
import { handle } from "@hono/node-server/vercel";
import { app } from "../src/app.js";

// Không để Vercel tự parse body — Hono đọc raw request.
export const config = { api: { bodyParser: false } };

export default handle(app);
