// ./utils/socket.js
const { Server } = require("socket.io");
const crypto=require("crypto");
const Chat = require("../models/chat");

const getSecretRoomId=(userId,targetUserId)=>{
  const hash=crypto.createHash("sha256");
  const ids=[userId,targetUserId].sort().join("_");
  hash.update(ids);
  return hash.digest("hex");
};

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173", // your frontend URL
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Connection Established from Backend:", socket.id);

    socket.on("join-room",({firstName, userId,targetUserId})=>{
      //const roomId=[userId,targetUserId].sort().join("_");
      const roomId=getSecretRoomId(userId,targetUserId);
      socket.join(roomId);
      console.log(`${firstName} joined room: ${roomId}`);

    })

    socket.on("send-message", async({firstName, userId,targetUserId, message }) => {
      // Save message to the Database
      try {
        const roomId=getSecretRoomId(userId,targetUserId);

        let chat=await Chat.findOne({
          participants:{$all:[userId,targetUserId]}
        });

        if (!chat){
          chat =new Chat({
            participants:[userId,targetUserId],
            messages:[],
          })
        }
        
        chat.messages.push({senderId:userId,text:message});
        await chat.save();

      io.to(roomId).emit("receive-message", {firstName, userId,targetUserId, message});

      } catch (error) {
        console.error("Error saving message to DB:", error);
      }

    });
    

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = initializeSocket;
