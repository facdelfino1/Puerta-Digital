// backend/server.js
require("dotenv").config({ path: __dirname + "/.env" });

const http = require("http");
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");


// Routers
const authRouter = require("./routes/auth");
const providersRouter = require("./routes/providers");
const providersStatusRouter = require("./routes/providers_status");
const accessLogsRouter = require("./routes/access_logs");
const settingsRouter = require("./routes/settings");
const dashboardRouter = require("./routes/dashboard");
const usersRouter = require("./routes/users");
const peopleRouter = require("./routes/people");
const areasRouter = require("./routes/areas");
const vehiclesRouter = require("./routes/vehicles");
const reportsRouter = require("./routes/reports");
const shellyRouter = require("./routes/shelly");

const { initRealtime } = require("./realtime");

const { authenticateToken, requireAnyRole } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

// CORS para permitir el frontend Next.js
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Middleware globales
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routers principales
app.use("/auth", authRouter);
app.use("/providers/status", providersStatusRouter);
app.use("/providers", providersRouter);
app.use("/access_logs", accessLogsRouter);
app.use("/settings", settingsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/users", authenticateToken, requireAnyRole(["supervisor", "administrador"]), usersRouter);
app.use(
  "/people",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  peopleRouter
);
app.use(
  "/areas",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  areasRouter
);
app.use(
  "/vehicles",
  authenticateToken,
  requireAnyRole(["guardia", "supervisor", "administrador"]),
  vehiclesRouter
);
app.use("/reports", authenticateToken, reportsRouter);
app.use("/shelly", shellyRouter);
app.post("/api/scan/log-access", shellyRouter.handleScan);

// Servir archivos estaticos (PDFs e imagenes)
const uploadsDir =
  process.env.UPLOADS_DIR && path.isAbsolute(process.env.UPLOADS_DIR)
    ? process.env.UPLOADS_DIR
    : path.join(
        __dirname,
        process.env.UPLOADS_DIR || path.join("..", "public", "uploads")
      );
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// Ruta base
app.get("/", (_req, res) => {
  res.send("API de Control de Acceso funcionando");
});

// Start server with WebSocket support
const server = http.createServer(app);
initRealtime(server);

server.listen(PORT);

