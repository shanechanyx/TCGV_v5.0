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

  socket.on('joinGame', (data) => {
    console.log('Player joining:', data);
    players.set(socket.id, {
      name: data.name,
      role: data.role,
      x: 400,
      y: 300
    });

    // Put player in room
    const roomId = data.roomId || 'default';
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    socket.join(roomId);

    // Send current players to new player
    const roomPlayers = Array.from(rooms.get(roomId)).map(id => ({
      id,
      ...players.get(id)
    }));
    socket.emit('gameState', roomPlayers);

    // Notify others
    socket.to(roomId).emit('playerJoined', {
      id: socket.id,
      ...players.get(socket.id)
    });
  });

  socket.on('move', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  socket.on('chat', (message) => {
    const player = players.get(socket.id);
    if (player) {
      io.emit('chatMessage', {
        id: socket.id,
        name: player.name,
        message
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const player = players.get(socket.id);
    if (player) {
      io.emit('playerLeft', socket.id);
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 