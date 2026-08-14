import type { Express, Request, Response } from "express";
import { streamLLM } from "./_core/llm";
import { buildSchemeHelpMessages, isValidSchemeHelpInput } from "./schemeHelp";

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const writeEvent = (res: Response, payload: Record<string, unknown>) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

export function registerSchemeHelpRoutes(app: Express) {
  app.post("/api/help/stream", async (req: Request, res: Response) => {
    if (!isValidSchemeHelpInput(req.body)) { res.status(400).json({ error: "Enter a question of up to 800 characters." }); return; }
    const now = Date.now(); const requestKey = req.ip || "unknown"; const window = requestWindows.get(requestKey); const activeWindow = !window || now - window.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : window;
    if (activeWindow.count >= MAX_REQUESTS_PER_WINDOW) { res.status(429).json({ error: "Please wait a few minutes before asking again." }); return; }
    activeWindow.count += 1; requestWindows.set(requestKey, activeWindow);
    const input = req.body;
    const abort = new AbortController(); let finished = false;
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" }); res.flushHeaders();
    res.on("close", () => { if (!finished) abort.abort(); });
    try {
      const upstream = await streamLLM({ model: "claude-haiku-4-5", max_tokens: 900, messages: buildSchemeHelpMessages(input) }, abort.signal);
      if (!upstream.body) throw new Error("The AI response stream was unavailable.");
      const reader = upstream.body.getReader(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += new TextDecoder().decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) { const value = line.trim(); if (!value.startsWith("data:")) continue; const payload = value.slice(5).trim(); if (payload === "[DONE]") continue; try { const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }; const delta = parsed.choices?.[0]?.delta?.content; if (delta) writeEvent(res, { type: "delta", text: delta }); } catch { /* Ignore non-chat compatibility events. */ } }
      }
      writeEvent(res, { type: "done" });
    } catch (error) { if (!abort.signal.aborted) { console.error("[SchemeHelp] Stream failed", error); writeEvent(res, { type: "error", message: "Scheme Sathi could not answer right now. Please try again or check the official portal." }); } }
    finally { finished = true; res.end(); }
  });
}
