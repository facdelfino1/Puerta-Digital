const { WebSocketServer, WebSocket } = require("ws");

let wss = null;
let heartbeatInterval = null;

function initRealtime(server) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: "/ws/access" });

  wss.on("connection", (socket) => {
    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });

    socket.send(
      JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
      })
    );
  });

  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    wss = null;
  });

  return wss;
}

function broadcastAccessEvent(payload) {
  if (!wss) return;
  const message = JSON.stringify({
    type: "access_event",
    timestamp: new Date().toISOString(),
    ...payload,
  });

  wss.clients.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

module.exports = {
  initRealtime,
  broadcastAccessEvent,
};
