// ./utils/socket.js
const { Server } = require("socket.io");

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173", // your frontend URL
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Listen for chat messages
    socket.on("chat message", (data) => {
      console.log("Received message:", data);

      // Here you can emit back to sender or broadcast to other users
      // For example, sending to all connected clients:
      io.emit("chat message", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = initializeSocket;
