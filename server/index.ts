import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore, normalizePlayerName, validSave } from "./store.ts";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

mkdirSync(path.join(root, "data"), { recursive: true });

const store = createStore(path.join(root, "data", "salon.sqlite"));

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.use("/api", (req, res, next) => {
  if (
    req.headers.origin &&
    req.headers.origin !== `http://${req.headers.host}`
  ) {
    res.status(403).json({ error: "허용되지 않은 요청입니다." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});

function requestedPlayer(value: unknown) {
  return normalizePlayerName(value);
}

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, database: "sqlite" }),
);

app.get("/api/players", (_req, res) =>
  res.json({ players: store.players() }),
);

app.get("/api/rankings", (_req, res) =>
  res.json({ rankings: store.rankings() }),
);

app.get("/api/save", (req, res) => {
  const player = requestedPlayer(req.query.player);
  res.json({ player, ...store.read(player) });
});

app.put("/api/save", (req, res) => {
  const player = requestedPlayer(req.body?.player ?? req.query.player);
  const save = { profile: req.body?.profile, game: req.body?.game };
  if (!validSave(save)) {
    res.status(400).json({ error: "저장 데이터 형식이 올바르지 않습니다." });
    return;
  }
  store.write(player, save);
  res.json({ ok: true, player });
});

app.delete("/api/save/:player", (req, res) => {
  const player = requestedPlayer(req.params.player);
  store.reset(player);
  res.json({ ok: true, player });
});

app.use("/api", (_req, res) =>
  res.status(404).json({ error: "없는 API입니다." }),
);

const production = process.argv.includes("--production");

if (production) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err.message);
    res
      .status(500)
      .json({ error: "요청을 처리하지 못했습니다. 다시 시도해주세요." });
  },
);
const server = app.listen(Number(process.env.PORT) || 3000, "127.0.0.1", () =>
  console.log("로열 살롱: http://localhost:3000"),
);
process.on("SIGINT", () =>
  server.close(() => {
    store.close();
    process.exit(0);
  }),
);
