const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const users = new Map(); // socket.id -> { name, socket }

io.on("connection", socket => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join", (userName) => {
    users.set(socket.id, { name: userName || `User${socket.id.slice(0, 6)}`, socket });
    console.log(`User ${userName || socket.id} joined. Total users: ${users.size}`);
    
    // Notify all users about the new user
    io.emit("userJoined", { 
      userId: socket.id, 
      userName: users.get(socket.id).name,
      totalUsers: users.size 
    });
    
    // Send list of existing users to the new user
    const existingUsers = Array.from(users.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ userId: id, userName: data.name }));
    
    socket.emit("existingUsers", existingUsers);
    
    // If there are 2+ users, trigger ready for WebRTC
    if (users.size >= 2) {
      io.emit("ready");
    }
  });

  socket.on("offer", data => {
    const userData = users.get(socket.id);
    socket.broadcast.emit("offer", { ...data, from: socket.id, userName: userData?.name });
  });
  
  socket.on("answer", data => {
    const userData = users.get(socket.id);
    socket.broadcast.emit("answer", { ...data, from: socket.id, userName: userData?.name });
  });
  
  socket.on("ice", data => {
    socket.broadcast.emit("ice", { ...data, from: socket.id });
  });

  socket.on("disconnect", () => {
    const userData = users.get(socket.id);
    if (userData) {
      console.log(`User ${userData.name} disconnected`);
      users.delete(socket.id);
      io.emit("userLeft", { userId: socket.id, userName: userData.name });
    }
  });
});

server.listen(3000, () => {
  console.log("📡 Signaling server running on port 3000");
});
