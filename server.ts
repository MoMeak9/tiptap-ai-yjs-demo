import { WebSocketServer, WebSocket } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";
import type { IncomingMessage } from "http";

const PORT = 1234;

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  setupWSConnection(ws, req);
  console.log("✅ New client connected");
});

wss.on("listening", () => {
  console.log(`🚀 WebSocket server running at: ws://localhost:${PORT}`);
  console.log("📝 Waiting for client connections...");
});

wss.on("error", (error: Error) => {
  console.error("❌ WebSocket server error:", error);
});

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down server...");
  wss.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
