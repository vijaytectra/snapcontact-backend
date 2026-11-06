import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { assertServerConfig } from "./lib/config";

// Refuse to start with missing or weak secrets instead of failing later or signing with a known key.
assertServerConfig();

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf?.toString(); } }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ name: "SnapContact API", status: "ok", docs: "/api/healthz" });
});

app.use("/api", router);

export default app;
