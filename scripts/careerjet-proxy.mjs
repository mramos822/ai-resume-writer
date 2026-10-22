// A tiny proxy with a fixed IP for Careerjet's API. Careerjet only answers from IP addresses declared in its partner panel, and the
// serverless host changes its address all the time, so the app sends the search here and this server (with a fixed IP) forwards it.
// No dependencies: node scripts/careerjet-proxy.mjs
//   PROXY_SECRET  the secret the app sends in the X-Proxy-Secret header (required: without it anybody could use the key)
//   PORT          default 8080
// It forwards ONLY GET /v4/query to search.api.careerjet.net, with the Authorization and Referer the app sent.
import http from "node:http";
import https from "node:https";

const SECRET = process.env.PROXY_SECRET;
if (!SECRET) {
  console.error("Set PROXY_SECRET first.");
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (req.method !== "GET" || url.pathname !== "/v4/query" || req.headers["x-proxy-secret"] !== SECRET) {
      res.writeHead(url.pathname === "/health" ? 200 : 403).end(url.pathname === "/health" ? "ok" : "forbidden");
      return;
    }
    const up = https.request(
      { host: "search.api.careerjet.net", path: `/v4/query${url.search}`, method: "GET", timeout: 9000, headers: { Accept: "application/json", Authorization: String(req.headers.authorization ?? ""), Referer: String(req.headers.referer ?? "") } },
      (r) => {
        res.writeHead(r.statusCode ?? 502, { "Content-Type": r.headers["content-type"] ?? "application/json" });
        r.pipe(res);
      }
    );
    up.on("timeout", () => up.destroy());
    up.on("error", () => res.headersSent || res.writeHead(502).end("bad gateway"));
    up.end();
  })
  .listen(Number(process.env.PORT) || 8080, () => console.log("careerjet proxy up"));
