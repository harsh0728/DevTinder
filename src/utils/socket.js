// // // ./utils/socket.js
// // const { Server } = require("socket.io");
// // const crypto=require("crypto");
// // const Chat = require("../models/chat");

// // const getSecretRoomId=(userId,targetUserId)=>{
// //   const hash=crypto.createHash("sha256");
// //   const ids=[userId,targetUserId].sort().join("_");
// //   hash.update(ids);
// //   return hash.digest("hex");
// // };

// // const initializeSocket = (server) => {
// //   const io = new Server(server, {
// //     cors: {
// //       origin: process.env.NODE_ENV === "production"?process.env.CLIENT_URL: "http://localhost:5173", // your frontend URL
// //       credentials: true,
// //       methods: ["GET", "POST"],
// //     },
// //   });

// //   io.on("connection", (socket) => {
// //     console.log("Connection Established from Backend:", socket.id);

// //     socket.on("join-room",({firstName, userId,targetUserId})=>{
// //       //const roomId=[userId,targetUserId].sort().join("_");
// //       const roomId=getSecretRoomId(userId,targetUserId);
// //       socket.join(roomId);
// //       console.log(`${firstName} joined room: ${roomId}`);

// //     })

// //     socket.on("send-message", async({firstName, userId,targetUserId, message }) => {
// //       // Save message to the Database
// //       try {
// //         const roomId=getSecretRoomId(userId,targetUserId);

// //         let chat=await Chat.findOne({
// //           participants:{$all:[userId,targetUserId]}
// //         });

// //         if (!chat){
// //           chat =new Chat({
// //             participants:[userId,targetUserId],
// //             messages:[],
// //           })
// //         }
        
// //         chat.messages.push({senderId:userId,text:message});
// //         await chat.save();

// //       io.to(roomId).emit("receive-message", {firstName, userId,targetUserId, message});

// //       } catch (error) {
// //         console.error("Error saving message to DB:", error);
// //       }

// //     });
    

// //     socket.on("disconnect", () => {
// //       console.log("User disconnected:", socket.id);
// //     });
// //   });
// // };

// // module.exports = initializeSocket;

// // utils/socket.js
// const { Server } = require("socket.io");
// const crypto = require("crypto");
// const Chat = require("../models/chat");

// // Generate unique consistent room for two users
// const getSecretRoomId = (userId, targetUserId) => {
//   const hash = crypto.createHash("sha256");
//   const ids = [userId, targetUserId].sort().join("_");
//   hash.update(ids);
//   return hash.digest("hex");
// };

// const initializeSocket = (server) => {
//   const io = new Server(server, {
//     cors: {
//       origin:
//         process.env.NODE_ENV === "production"
//           ? process.env.CLIENT_URL
//           : "http://localhost:5173",
//       credentials: true,
//       methods: ["GET", "POST"],
//     },
//   });

//   io.on("connection", (socket) => {
//     console.log("Connection Established:", socket.id);

//     /***********************************
//      * 
//      *  🔵 CHAT EVENTS
//      * 
//      ***********************************/

//     socket.on("join-room", ({ firstName, userId, targetUserId }) => {
//       const roomId = getSecretRoomId(userId, targetUserId);

//       socket.join(roomId);

//       console.log(`${firstName} joined room: ${roomId}`);
//     });

//     socket.on("send-message", async ({ firstName, userId, targetUserId, message }) => {
//       try {
//         const roomId = getSecretRoomId(userId, targetUserId);

//         let chat = await Chat.findOne({
//           participants: { $all: [userId, targetUserId] },
//         });

//         if (!chat) {
//           chat = new Chat({
//             participants: [userId, targetUserId],
//             messages: [],
//           });
//         }

//         chat.messages.push({ senderId: userId, text: message });
//         await chat.save();

//         io.to(roomId).emit("receive-message", {
//           firstName,
//           userId,
//           targetUserId,
//           message,
//         });
//       } catch (error) {
//         console.error("Error saving message to DB:", error);
//       }
//     });

//     /***********************************
//      * 
//      *  🔴 CALLING EVENTS
//      * 
//      ***********************************/

//     /**
//      * A user joins a call room (same as chatting room)
//      */
//     // socket.on("join-call", ({ userId, targetUserId }) => {
//     //   const roomId = getSecretRoomId(userId, targetUserId);
//     //   socket.join(roomId);

//     //   console.log(`User ${userId} joined call room: ${roomId}`);

//     //   // Notify others in room
//     //   socket.to(roomId).emit("user-joined-call", { userId });
//     // });

//     // /**
//     //  * 1️⃣ SEND OFFER (Caller → Receiver)
//     //  */
//     // socket.on("call-offer", ({ roomId, from, to, offer }) => {
//     //   io.to(roomId).emit("call-offer", { from, to, offer });
//     // });

//     // /**
//     //  * 2️⃣ SEND ANSWER (Receiver → Caller)
//     //  */
//     // socket.on("call-answer", ({ roomId, from, to, answer }) => {
//     //   io.to(roomId).emit("call-answer", { from, to, answer });
//     // });

//     // /**
//     //  * 3️⃣ ICE CANDIDATES (Both directions)
//     //  */
//     // socket.on("ice-candidate", ({ roomId, from, to, candidate }) => {
//     //   io.to(roomId).emit("ice-candidate", { from, to, candidate });
//     // });

//     // /**
//     //  * 4️⃣ CALL ENDED EVENT
//     //  */
//     // socket.on("end-call", ({ roomId, userId }) => {
//     //   io.to(roomId).emit("call-ended", { userId });
//     //   console.log(`Call ended by ${userId}`);
//     // });

//      socket.on("call-user", (data) => {
//     io.to(data.to).emit("incoming-call", {
//       from: socket.id,
//       offer: data.offer,
//     });
//   });

//   socket.on("answer-call", (data) => {
//     io.to(data.to).emit("call-answered", {
//       answer: data.answer,
//     });
//   });

//   socket.on("ice-candidate", (data) => {
//     io.to(data.to).emit("ice-candidate", data.candidate);
//   });

//     /***********************************
//      * 
//      *  🔵 DISCONNECT
//      * 
//      ***********************************/
//     socket.on("disconnect", () => {
//       console.log("User disconnected:", socket.id);
//     });
//   });
// };

// module.exports = initializeSocket;
const { Server } = require("socket.io");
const crypto = require("crypto");
const Chat = require("../models/chat");

// Generate unique consistent room for two users
const getSecretRoomId = (userId, targetUserId) => {
  const hash = crypto.createHash("sha256");
  const ids = [userId, targetUserId].sort().join("_");
  hash.update(ids);
  return hash.digest("hex");
};

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.CLIENT_URL
          : "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Store online users and their socket IDs
  const onlineUsers = new Map(); // userId -> socketId
  const activeCallRooms = new Map(); // roomId -> {caller, receiver, callType}

  io.on("connection", (socket) => {
    console.log("Connection Established:", socket.id);

    /***********************************
     * 
     *  🟢 USER PRESENCE
     * 
     ***********************************/

    socket.on("user-online", ({ userId }) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId; // Store userId in socket
      console.log(`User ${userId} is online with socket ${socket.id}`);
      
      // Broadcast to all clients that this user is online
      socket.broadcast.emit("user-online", { userId });
    });

    /***********************************
     * 
     *  🔵 CHAT EVENTS
     * 
     ***********************************/

    socket.on("join-room", ({ firstName, userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.join(roomId);
      console.log(`${firstName} joined room: ${roomId}`);
    });

    socket.on("send-message", async ({ firstName, userId, targetUserId, message }) => {
      try {
        const roomId = getSecretRoomId(userId, targetUserId);

        let chat = await Chat.findOne({
          participants: { $all: [userId, targetUserId] },
        });

        if (!chat) {
          chat = new Chat({
            participants: [userId, targetUserId],
            messages: [],
          });
        }

        chat.messages.push({ senderId: userId, text: message });
        await chat.save();

        io.to(roomId).emit("receive-message", {
          firstName,
          userId,
          targetUserId,
          message,
        });
      } catch (error) {
        console.error("Error saving message to DB:", error);
      }
    });

    // Typing indicators
    socket.on("typing", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("user-typing", { userId });
    });

    socket.on("stop-typing", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("user-stop-typing", { userId });
    });

    // Message operations
    socket.on("delete-message", ({ messageId, targetUserId }) => {
      const userId = socket.userId;
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("message-deleted", { messageId });
    });

    socket.on("edit-message", ({ messageId, newText, targetUserId }) => {
      const userId = socket.userId;
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.to(roomId).emit("message-edited", { messageId, newText });
    });

    /***********************************
     * 
     *  📞 WEBRTC CALLING EVENTS
     * 
     ***********************************/

    /**
     * Join call room - When user navigates to call page
     */
    socket.on("join-call-room", ({ userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      socket.join(roomId);
      console.log(`User ${userId} joined call room: ${roomId}`);
      
      // Notify the other user in the room
      socket.to(roomId).emit("user-joined-call-room", { userId });
    });

    /**
     * Initiate a call (audio or video)
     */
    socket.on("initiate-call", ({ callerId, receiverId, callType }) => {
      const roomId = getSecretRoomId(callerId, receiverId);
      const receiverSocketId = onlineUsers.get(receiverId);

      if (receiverSocketId) {
        // Store active call info
        activeCallRooms.set(roomId, {
          caller: callerId,
          receiver: receiverId,
          callType, // 'audio' or 'video'
          status: 'ringing'
        });

        // Send incoming call notification to receiver
        io.to(receiverSocketId).emit("incoming-call", {
          callerId,
          roomId,
          callType,
        });

        console.log(`Call initiated: ${callerId} -> ${receiverId} (${callType})`);
      } else {
        // Receiver is offline
        socket.emit("call-failed", { 
          reason: "User is offline",
          receiverId 
        });
      }
    });

    /**
     * Accept incoming call
     */
    socket.on("accept-call", ({ roomId, userId }) => {
      const callInfo = activeCallRooms.get(roomId);
      
      if (callInfo) {
        callInfo.status = 'connected';
        activeCallRooms.set(roomId, callInfo);
        
        // Notify caller that call was accepted
        io.to(roomId).emit("call-accepted", { 
          userId,
          callType: callInfo.callType 
        });
        
        console.log(`Call accepted in room: ${roomId}`);
      }
    });

    /**
     * Reject incoming call
     */
    socket.on("reject-call", ({ roomId, userId }) => {
      // Notify the caller
      io.to(roomId).emit("call-rejected", { userId });
      
      // Clean up
      activeCallRooms.delete(roomId);
      console.log(`Call rejected in room: ${roomId}`);
    });

    /**
     * WebRTC Signaling: Send offer
     */
    socket.on("webrtc-offer", ({ roomId, offer }) => {
      console.log(`WebRTC offer sent to room: ${roomId}`);
      socket.to(roomId).emit("webrtc-offer", { offer });
    });

    /**
     * WebRTC Signaling: Send answer
     */
    socket.on("webrtc-answer", ({ roomId, answer }) => {
      console.log(`WebRTC answer sent to room: ${roomId}`);
      socket.to(roomId).emit("webrtc-answer", { answer });
    });

    /**
     * WebRTC Signaling: ICE Candidate
     */
    socket.on("webrtc-ice-candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("webrtc-ice-candidate", { candidate });
    });

    /**
     * Toggle video during call
     */
    socket.on("toggle-video", ({ roomId, videoEnabled }) => {
      socket.to(roomId).emit("remote-video-toggle", { videoEnabled });
      console.log(`Video toggled in room ${roomId}: ${videoEnabled}`);
    });

    /**
     * Toggle audio during call
     */
    socket.on("toggle-audio", ({ roomId, audioEnabled }) => {
      socket.to(roomId).emit("remote-audio-toggle", { audioEnabled });
      console.log(`Audio toggled in room ${roomId}: ${audioEnabled}`);
    });

    /**
     * End call
     */
    socket.on("end-call", ({ roomId }) => {
      console.log(`Call ended in room: ${roomId}`);
      
      // Notify all users in the room
      io.to(roomId).emit("call-ended", { roomId });
      
      // Clean up
      activeCallRooms.delete(roomId);
    });

    /***********************************
     * 
     *  🔴 DISCONNECT
     * 
     ***********************************/
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      
      // Remove from online users
      const userId = socket.userId;
      if (userId) {
        onlineUsers.delete(userId);
        
        // Broadcast offline status
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

module.exports = initializeSocket;