content = """const { Server } = require("socket.io");
const crypto = require("crypto");
const Chat = require("../models/chat");
const { redisClient } = require("../config/redis");

// Sanitize message to prevent XSS - using a map to avoid HTML entity encoding issues
const sanitizeMessage = (text) => {
  const entityMap = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": "'",
    '/': '&#x2F;'
  };
  return String(text).replace(/[&<>"'\\/]/g, (char) => entityMap[char] || char);
};

// Generate room ID for CHAT
const getChatRoomId = (userId, targetUserId) => {
  const hash = crypto.createHash("sha256");
  const ids = [userId, targetUserId].sort().join("_");
  hash.update(ids);
  return hash.digest("hex");
};

// SEPARATE room ID for CALL signaling - "call:" prefix prevents collision with chat rooms
const getCallRoomId = (userId, targetUserId) => {
  return "call:" + getChatRoomId(userId, targetUserId);
};

// Rate limiting for socket events (per user)
const socketRateLimiter = new Map(); // userId -> { count, resetTime }
const RATE_LIMIT_WINDOW = 1000; // 1 second
const RATE_LIMIT_MAX_EVENTS = 30; // max events per window

const checkRateLimit = (userId) => {
  const now = Date.now();
  const userLimit = socketRateLimiter.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    socketRateLimiter.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_EVENTS) {
    return false;
  }

  userLimit.count++;
  return true;
};

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of socketRateLimiter.entries()) {
    if (now > limit.resetTime) {
      socketRateLimiter.delete(userId);
    }
  }
}, 60000); // Clean up every minute

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        const allowed = [
          "http://localhost:5173",
          "http://localhost:3000",
          process.env.CLIENT_URL,
        ].filter(Boolean);
        if (!origin || allowed.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    // Enable adapter for horizontal scaling when Redis is available
    adapter: redisClient ? require("@socket.io/redis-adapter").createAdapter(redisClient) : undefined,
  });

  // Store online users and their socket IDs (also in Redis for multi-server)
  const onlineUsers = new Map(); // userId -> socketId
  const activeCallRooms = new Map(); // roomId -> {caller, receiver, callType, status}

  // Helper to persist online status to Redis
  const setUserOnline = async (userId, socketId) => {
    onlineUsers.set(userId, socketId);
    if (redisClient) {
      await redisClient.hSet("online_users", userId, socketId);
      await redisClient.expire("online_users", 86400); // 24 hours
    }
  };

  const setUserOffline = async (userId) => {
    onlineUsers.delete(userId);
    if (redisClient) {
      await redisClient.hDel("online_users", userId);
    }
  };

  const getReceiverSocketId = async (receiverId) => {
    // Try local map first
    let socketId = onlineUsers.get(receiverId);
    if (socketId) return socketId;

    // Fallback to Redis for multi-server
    if (redisClient) {
      socketId = await redisClient.hGet("online_users", receiverId);
      if (socketId) {
        onlineUsers.set(receiverId, socketId); // Cache locally
      }
    }
    return socketId;
  };

  io.on("connection", (socket) => {
    console.log("Connection Established:", socket.id);

    /***********************************
     *  USER PRESENCE
     ***********************************/

    socket.on("user-online", async ({ userId }) => {
      if (!userId) return;

      await setUserOnline(userId, socket.id);
      socket.userId = userId;
      console.log(`User ${userId} is online with socket ${socket.id}`);
      socket.broadcast.emit("user-online", { userId });
    });

    /***********************************
     *  CHAT EVENTS - uses getChatRoomId (plain hex hash)
     ***********************************/

    socket.on("join-room", ({ firstName, userId, targetUserId }) => {
      if (!userId || !targetUserId) return;

      const roomId = getChatRoomId(userId, targetUserId);
      socket.join(roomId);
      console.log(`${firstName || userId} joined chat room: ${roomId}`);
    });

    socket.on("send-message", async ({ firstName, userId, targetUserId, message, tempId }) => {
      // Rate limiting
      if (!checkRateLimit(userId)) {
        socket.emit("message-error", { tempId, error: "Rate limit exceeded. Please slow down." });
        return;
      }

      // Validate message
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        socket.emit("message-error", { tempId, error: "Message cannot be empty" });
        return;
      }

      if (message.length > 5000) {
        socket.emit("message-error", { tempId, error: "Message too long (max 5000 characters)" });
        return;
      }

      // Sanitize message (basic XSS prevention)
      const sanitizedMessage = sanitizeMessage(message);

      try {
        const roomId = getChatRoomId(userId, targetUserId);
        let chat = await Chat.findOne({ participants: { $all: [userId, targetUserId] } });

        if (!chat) {
          chat = new Chat({ participants: [userId, targetUserId], messages: [] });
        }

        const newMessage = {
          senderId: userId,
          text: sanitizedMessage,
        };

        chat.messages.push(newMessage);
        const savedChat = await chat.save();

        // Get the saved message with its _id
        const savedMessage = savedChat.messages[savedChat.messages.length - 1];

        // Emit to room with the saved message ID
        io.to(roomId).emit("receive-message", {
          _id: savedMessage._id,
          firstName,
          userId,
          targetUserId,
          message: sanitizedMessage,
          createdAt: savedMessage.createdAt,
          updatedAt: savedMessage.updatedAt,
          tempId, // Echo back tempId for client to match optimistic update
        });

        // Also send acknowledgment to sender
        socket.emit("message-sent", { tempId, messageId: savedMessage._id });

      } catch (error) {
        console.error("Error saving message to DB:", error);
        socket.emit("message-error", { tempId, error: "Failed to send message" });
      }
    });

    socket.on("typing", ({ userId, targetUserId }) => {
      if (!userId || !targetUserId) return;
      socket.to(getChatRoomId(userId, targetUserId)).emit("user-typing", { userId });
    });

    socket.on("stop-typing", ({ userId, targetUserId }) => {
      if (!userId || !targetUserId) return;
      socket.to(getChatRoomId(userId, targetUserId)).emit("user-stop-typing", { userId });
    });

    // Delete message - actually deletes from DB
    socket.on("delete-message", async ({ messageId, targetUserId }) => {
      const userId = socket.userId;
      if (!userId || !messageId || !targetUserId) return;

      try {
        const roomId = getChatRoomId(userId, targetUserId);
        const chat = await Chat.findOne({ participants: { $all: [userId, targetUserId] } });

        if (!chat) return;

        // Find message and verify ownership
        const messageIndex = chat.messages.findIndex(
          (msg) => msg._id.toString() === messageId && msg.senderId.toString() === userId
        );

        if (messageIndex === -1) {
          socket.emit("message-error", { error: "Message not found or unauthorized" });
          return;
        }

        // Remove message
        chat.messages.splice(messageIndex, 1);
        await chat.save();

        // Notify room
        io.to(roomId).emit("message-deleted", { messageId });
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("message-error", { error: "Failed to delete message" });
      }
    });

    // Edit message - actually updates in DB
    socket.on("edit-message", async ({ messageId, newText, targetUserId }) => {
      const userId = socket.userId;
      if (!userId || !messageId || !newText || !targetUserId) return;

      // Validate
      if (newText.trim().length === 0 || newText.length > 5000) {
        socket.emit("message-error", { error: "Invalid message length" });
        return;
      }

      // Sanitize
      const sanitizedText = sanitizeMessage(newText);

      try {
        const roomId = getChatRoomId(userId, targetUserId);
        const chat = await Chat.findOne({ participants: { $all: [userId, targetUserId] } });

        if (!chat) return;

        // Find message and verify ownership
        const message = chat.messages.find(
          (msg) => msg._id.toString() === messageId && msg.senderId.toString() === userId
        );

        if (!message) {
          socket.emit("message-error", { error: "Message not found or unauthorized" });
          return;
        }

        // Update message
        message.text = sanitizedText;
        // updatedAt will be automatically updated by mongoose timestamps
        await chat.save();

        // Notify room
        io.to(roomId).emit("message-edited", {
          messageId,
          newText: sanitizedText,
          updatedAt: message.updatedAt,
        });
      } catch (error) {
        console.error("Error editing message:", error);
        socket.emit("message-error", { error: "Failed to edit message" });
      }
    });

    /***********************************
     *  WEBRTC CALLING EVENTS - uses getCallRoomId ("call:" prefixed)
     ***********************************/

    socket.on("join-call-room", ({ userId, targetUserId }) => {
      if (!userId || !targetUserId) return;

      const callRoomId = getCallRoomId(userId, targetUserId);
      socket.join(callRoomId);
      console.log(`User ${userId} joined call room: ${callRoomId}`);
      socket.to(callRoomId).emit("user-joined-call-room", { userId });
    });

    socket.on("initiate-call", ({ callerId, receiverId, callType }) => {
      if (!callerId || !receiverId || !callType) return;

      const callRoomId = getCallRoomId(callerId, receiverId);

      // Check rate limit for calls
      if (!checkRateLimit(callerId)) {
        socket.emit("call-failed", { reason: "Too many call attempts. Please wait." });
        return;
      }

      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        activeCallRooms.set(callRoomId, {
          caller: callerId,
          receiver: receiverId,
          callType,
          status: "ringing"
        });
        io.to(receiverSocketId).emit("incoming-call", {
          callerId,
          roomId: callRoomId,
          callType
        });
        console.log(`Call initiated: ${callerId} -> ${receiverId} (${callType})`);
      } else {
        socket.emit("call-failed", {
          reason: "User is offline",
          receiverId
        });
      }
    });

    socket.on("accept-call", ({ roomId, userId }) => {
      if (!roomId || !userId) return;

      const callInfo = activeCallRooms.get(roomId);
      if (callInfo) {
        callInfo.status = "connected";
        activeCallRooms.set(roomId, callInfo);
        io.to(roomId).emit("call-accepted", {
          userId,
          callType: callInfo.callType
        });
        console.log(`Call accepted in room: ${roomId}`);
      }
    });

    socket.on("reject-call", ({ roomId, userId }) => {
      if (!roomId) return;
      io.to(roomId).emit("call-rejected", { userId });
      activeCallRooms.delete(roomId);
      console.log(`Call rejected in room: ${roomId}`);
    });

    socket.on("webrtc-offer", ({ roomId, offer }) => {
      if (!roomId || !offer) return;
      socket.to(roomId).emit("webrtc-offer", { offer });
    });

    socket.on("webrtc-answer", ({ roomId, answer }) => {
      if (!roomId || !answer) return;
      socket.to(roomId).emit("webrtc-answer", { answer });
    });

    socket.on("webrtc-ice-candidate", ({ roomId, candidate }) => {
      if (!roomId || !candidate) return;
      socket.to(roomId).emit("webrtc-ice-candidate", { candidate });
    });

    // Broadcast with senderId - client ignores its own echoed events
    socket.on("toggle-video", ({ roomId, videoEnabled, senderId }) => {
      if (!roomId || typeof videoEnabled !== "boolean" || !senderId) return;
      io.to(roomId).emit("remote-video-toggle", { videoEnabled, senderId });
      console.log(`Video toggled in room ${roomId}: ${videoEnabled}`);
    });

    socket.on("toggle-audio", ({ roomId, audioEnabled, senderId }) => {
      if (!roomId || typeof audioEnabled !== "boolean" || !senderId) return;
      io.to(roomId).emit("remote-audio-toggle", { audioEnabled, senderId });
      console.log(`Audio toggled in room ${roomId}: ${audioEnabled}`);
    });

    socket.on("end-call", ({ roomId }) => {
      if (!roomId) return;
      io.to(roomId).emit("call-ended", { roomId });
      activeCallRooms.delete(roomId);
      console.log(`Call ended in room: ${roomId}`);
    });

    /***********************************
     *  DISCONNECT
     ***********************************/

    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);
      const userId = socket.userId;
      if (userId) {
        await setUserOffline(userId);

        socket.broadcast.emit("user-offline", {
          userId,
          lastSeen: new Date().toISOString()
        });

        // Clean up any active calls
        activeCallRooms.forEach((callInfo, roomId) => {
          if (callInfo.caller === userId || callInfo.receiver === userId) {
            io.to(roomId).emit("call-ended", { roomId, reason: "User disconnected" });
            activeCallRooms.delete(roomId);
          }
        });
      }
    });
  });

  return io;
};

module.exports = initializeSocket;"""

with open('E:/MERN-PROJECTS/DEV-TINDER/src/utils/socket.js', 'w') as f:
    f.write(content)
print('File written successfully')