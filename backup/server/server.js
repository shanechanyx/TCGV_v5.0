const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const players = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Initialize player on connection
  players.set(socket.id, {
    name: null,
    role: null,
    room: null,
    x: 400,
    y: 300
  });

  socket.on('joinGame', (data) => {
    console.log('Player joining:', data);
    const player = players.get(socket.id);
    
    if (player) {
      player.name = data.name;
      player.role = data.role;
      
      // Put player in default room
      const roomId = data.roomId || 'default';
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      
      rooms.get(roomId).add(socket.id);
      player.room = roomId;
      socket.join(roomId);

      // Send current players to new player
      const roomPlayers = Array.from(rooms.get(roomId))
        .map(id => {
          const p = players.get(id);
          return p ? { id, ...p } : null;
        })
        .filter(Boolean);
        
      socket.emit('gameState', roomPlayers);

      // Notify others
      socket.to(roomId).emit('playerJoined', {
        id: socket.id,
        ...players.get(socket.id)
      });
    }
  });

  socket.on('move', (data) => {
    const player = players.get(socket.id);
    if (player && player.room) {
      player.x = data.x;
      player.y = data.y;
      socket.to(player.room).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('chat', (message) => {
    const player = players.get(socket.id);
    if (player && player.room) {
      const chatMessage = {
        id: socket.id,
        name: player.name,
        message
      };
      io.to(player.room).emit('chatMessage', chatMessage);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const player = players.get(socket.id);
    if (player && player.room) {
      if (rooms.has(player.room)) {
        const room = rooms.get(player.room);
        room.delete(socket.id);
        socket.to(player.room).emit('playerLeft', socket.id);
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(player.room);
        }
      }
    }
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 