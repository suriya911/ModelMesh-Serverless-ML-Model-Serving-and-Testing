import type { VercelRequest, VercelResponse } from "@vercel/node";

function buildTargetUrl(req: VercelRequest): string {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");
  const queryIndex = req.url?.indexOf("?") ?? -1;
  const query = queryIndex >= 0 && req.url ? req.url.slice(queryIndex) : "";
  return `${base}/${path}${query}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backendBase = process.env.BACKEND_URL;
  if (!backendBase) {
    return res.status(500).json({ detail: "Missing BACKEND_URL environment variable in Vercel." });
  }

  const targetUrl = buildTargetUrl(req);
  const method = req.method || "GET";
  const headers: Record<string, string> = {};

  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value) return;
    if (key.toLowerCase() === "host") return;
    headers[key] = Array.isArray(value) ? value.join(",") : value;
  });

  const isBodyAllowed = !["GET", "HEAD"].includes(method.toUpperCase());
  const body = isBodyAllowed && req.body ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : undefined;

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const contentType = response.headers.get("content-type");
    const responseBody = await response.text();
    if (contentType) {
      res.setHeader("content-type", contentType);
    }
    return res.status(response.status).send(responseBody);
  } catch (error) {
    return res.status(502).json({
      detail: "Proxy request to backend failed.",
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}
