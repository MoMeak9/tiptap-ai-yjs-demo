import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

const PORT = 1234;

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
  console.log("✅ 新客户端已连接");
});

wss.on("listening", () => {
  console.log(`🚀 WebSocket 服务器运行在: ws://localhost:${PORT}`);
  console.log("📝 等待客户端连接...");
});

wss.on("error", (error) => {
  console.error("❌ WebSocket 服务器错误:", error);
});

process.on("SIGINT", () => {
  console.log("\n👋 正在关闭服务器...");
  wss.close(() => {
    console.log("✅ 服务器已关闭");
    process.exit(0);
  });
});
