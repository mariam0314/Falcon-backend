const jwt = require("jsonwebtoken");

function socketHandler(io) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      // Allow connection if optional, but track unauthenticated state
      socket.userId = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId ? decoded.userId.toString() : null;
      next();
    } catch (err) {
      // Invalid token — log and permit or reject depending on auth requirement
      socket.userId = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log("Socket client connected:", socket.id, socket.userId ? `(User: ${socket.userId})` : "(Anonymous)");

    // Join a chat room with authorization check
    socket.on("joinRoom", (roomId) => {
      if (!roomId) return;

      // If room is user-to-user (format: userId1_userId2) and socket is authenticated
      if (socket.userId && typeof roomId === "string" && roomId.includes("_")) {
        const participants = roomId.split("_");
        // Ensure user is either a participant in the room or admin
        if (!participants.includes(socket.userId)) {
          console.warn(`[Socket] Unauthorized joinRoom blocked: User ${socket.userId} tried to join ${roomId}`);
          return;
        }
      }

      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });

    // Leave a chat room
    socket.on("leaveRoom", (roomId) => {
      if (!roomId) return;
      socket.leave(roomId);
      console.log(`Socket ${socket.id} left room: ${roomId}`);
    });

    // Typing indicators
    socket.on("typing", (roomId) => {
      if (!roomId) return;
      socket.to(roomId).emit("typing");
    });

    socket.on("stopTyping", (roomId) => {
      if (!roomId) return;
      socket.to(roomId).emit("stopTyping");
    });

    socket.on("disconnect", () => {
      console.log("Socket client disconnected:", socket.id);
    });
  });
}

module.exports = socketHandler;
