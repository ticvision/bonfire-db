import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const host = process.env.BONFIRE_DEMO_HOST ?? "127.0.0.1";
const port = Number(process.env.BONFIRE_DEMO_PORT ?? "5173");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function resolvePath(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const requested = normalize(pathname === "/" ? "/index.html" : pathname);
  const filePath = join(root, requested);

  if (!filePath.startsWith(root)) return join(root, "index.html");
  if (existsSync(filePath)) return filePath;
  return join(root, "index.html");
}

createServer((request, response) => {
  const filePath = resolvePath(request.url ?? "/");
  response.setHeader("Content-Type", contentTypes.get(extname(filePath)) ?? "application/octet-stream");
  createReadStream(filePath)
    .on("error", () => {
      response.statusCode = 404;
      response.end("not found");
    })
    .pipe(response);
}).listen(port, host, () => {
  console.log(`bonfire demo listening on http://${host}:${port}`);
});
