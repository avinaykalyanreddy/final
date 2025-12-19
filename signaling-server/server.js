const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// rooms: roomId -> Map(socketId -> { name })
const rooms = new Map();
// lastActions: roomId -> Map(userName -> { userId, userName, action, timestamp })
const lastActions = new Map();

io.on("connection", socket => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join", ({ roomId, userName }) => {
    roomId = roomId || "default";
    const name = userName || `User${socket.id.slice(0, 6)}`;

    // Save room info on the socket for cleanup
    socket.data.roomId = roomId;
    socket.data.userName = name;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const roomUsers = rooms.get(roomId);
    roomUsers.set(socket.id, { name });

    console.log(`User ${name} joined room ${roomId}. Total users in room: ${roomUsers.size}`);

    // Join the Socket.IO room
    socket.join(roomId);

    // Send list of existing users in this room to the new user
    const existingUsers = Array.from(roomUsers.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ userId: id, userName: data.name }));

    socket.emit("existingUsers", existingUsers);

    // Send existing last actions in this room so the new user sees
    // current messages for everyone immediately.
    const roomLastActions = lastActions.get(roomId);
    if (roomLastActions) {
      const existingActions = Array.from(roomLastActions.values());
      if (existingActions.length > 0) {
        socket.emit("existingActions", existingActions);
      }
    }

    // Notify other users in the room about the new user
    socket.to(roomId).emit("userJoined", {
      userId: socket.id,
      userName: name,
      totalUsers: roomUsers.size
    });
  });

  // WebRTC signaling: target specific users by socket id
  socket.on("offer", data => {
    const { to, ...offer } = data;
    const roomId = socket.data.roomId;
    const name = socket.data.userName || `User${socket.id.slice(0, 6)}`;
    if (!to || !roomId) return;

    io.to(to).emit("offer", { ...offer, from: socket.id, userName: name });
  });
  
  socket.on("answer", data => {
    const { to, ...answer } = data;
    const roomId = socket.data.roomId;
    const name = socket.data.userName || `User${socket.id.slice(0, 6)}`;
    if (!to || !roomId) return;

    io.to(to).emit("answer", { ...answer, from: socket.id, userName: name });
  });
  
  socket.on("ice", data => {
    const { to, ...candidate } = data;
    const roomId = socket.data.roomId;
    if (!to || !roomId) return;

    io.to(to).emit("ice", { ...candidate, from: socket.id });
  });

  // Broadcast sign actions (captions) to everyone in the same room
  socket.on("action", payload => {
    let { roomId, userName, action, timestamp } = payload || {};
    roomId = roomId || socket.data.roomId;
    if (!roomId || !action) return;

    const name = userName || socket.data.userName || `User${socket.id.slice(0, 6)}`;
    const ts = timestamp || Date.now();

    // Store last action per user in this room
    if (!lastActions.has(roomId)) {
      lastActions.set(roomId, new Map());
    }
    const roomLastActions = lastActions.get(roomId);
    roomLastActions.set(name, {
      userId: socket.id,
      userName: name,
      action,
      timestamp: ts,
    });

    // Broadcast to everyone in the room
    io.to(roomId).emit("action", {
      userId: socket.id,
      userName: name,
      action,
      timestamp: ts,
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const name = socket.data.userName;

    if (!roomId || !rooms.has(roomId)) return;

    const roomUsers = rooms.get(roomId);
    if (roomUsers.has(socket.id)) {
      roomUsers.delete(socket.id);
      console.log(`User ${name || socket.id} left room ${roomId}. Remaining: ${roomUsers.size}`);

      // Notify others in the room
      socket.to(roomId).emit("userLeft", { userId: socket.id, userName: name });

      // Clean up empty room
      if (roomUsers.size === 0) {
        rooms.delete(roomId);
        lastActions.delete(roomId);
      }
    }
  });
});

server.listen(3000, () => {
  console.log("📡 Signaling server running on port 3000");
});
