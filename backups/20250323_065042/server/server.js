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
const roomBackgrounds = new Map(); // Store background settings for each room
const voiceChatUsers = new Map(); // Store users who are in voice chat
const talkingUsers = new Map(); // Store users who are currently talking

// Debug helper to show full content of complex objects
const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value));
      }
      return value;
    }, 2);
  } catch (e) {
    return `[Error stringifying object: ${e.message}]`;
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Initialize player on connection
  players.set(socket.id, {
    name: null,
    role: null,
    room: null,
    position: { x: 50, y: 100 },
    spriteId: '8bit', // Default sprite
    animation: 'idle', // Default animation
    direction: 'down'  // Default direction
  });

  // Handle create or join room
  socket.on('joinRoom', (data) => {
    console.log('Player joining room:', data);
    const player = players.get(socket.id);
    
    if (!player) {
      socket.emit('error', 'Player not found');
      return;
    }
    
    const roomId = data.roomId.trim();
    
    // Update player info
    player.name = data.name;
    player.role = data.role;
    player.bubbleColor = data.bubbleColor || '#2c5282';
    player.spriteId = data.spriteId || '8bit'; // Store sprite ID
    
    // Leave previous room if any
    if (player.room && rooms.has(player.room)) {
      const oldRoom = rooms.get(player.room);
      oldRoom.delete(socket.id);
      socket.leave(player.room);
      console.log(`Player ${socket.id} left room ${player.room}`);
      socket.to(player.room).emit('playerLeft', {
        id: socket.id,
        name: player.name
      });
    }
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      console.log('Creating new room:', roomId);
      rooms.set(roomId, new Set());
    }
    
    // Join the room
    const room = rooms.get(roomId);
    room.add(socket.id);
    player.room = roomId;
    
    // Actually join the socket.io room
    socket.join(roomId);
    console.log(`Player ${socket.id} (${player.name}) joined room ${roomId}`);
    console.log(`Room now has ${room.size} players`);
    
    // Dump current room state
    console.log('Current room state:');
    room.forEach(id => {
      const p = players.get(id);
      if (p) {
        console.log(` - ${id}: ${p.name}, position:`, p.position);
      }
    });
    
    // Get all players in the room
    const roomPlayers = Array.from(room).map(id => {
      const p = players.get(id);
      return p ? {
        id,
        name: p.name,
        role: p.role,
        position: p.position,
        bubbleColor: p.bubbleColor,
        spriteId: p.spriteId,
        animation: p.animation,
        direction: p.direction
      } : null;
    }).filter(Boolean);
    
    console.log(`Sending ${roomPlayers.length} player info to new player ${socket.id}`);
    
    // Get current background settings for the room
    const backgroundSettings = roomBackgrounds.get(roomId);
    console.log(`Background settings for room ${roomId}:`, safeStringify(backgroundSettings));
    
    // Send room info to player, including background settings if available
    socket.emit('roomJoined', {
      roomId: roomId,
      players: roomPlayers,
      backgroundSettings: backgroundSettings || null // Send background settings if available
    });
    console.log(`Sent room joined data to ${socket.id} with background:`, backgroundSettings ? 'YES' : 'NO');
    
    // Notify others in the room about the new player
    socket.to(roomId).emit('playerJoined', {
      id: socket.id,
      name: player.name,
      role: player.role,
      position: player.position,
      bubbleColor: player.bubbleColor,
      spriteId: player.spriteId,
      animation: player.animation,
      direction: player.direction
    });
    
    // Log the current state of all players for debugging
    console.log('All players in server:');
    players.forEach((p, id) => {
      console.log(` - ${id}: ${p.name}, room: ${p.room}, position:`, p.position);
    });
  });

  // Handle position updates with improved broadcasting
  socket.on('updatePosition', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.room) {
      console.error('Player or room not found for position update');
      return;
    }
    
    // Update player state
    player.position = data.position;
    if (data.animation) player.animation = data.animation;
    if (data.direction) player.direction = data.direction;
    
    // Check if room exists
    const room = rooms.get(player.room);
    if (!room) {
      console.error(`Room ${player.room} not found for broadcasting movement`);
      return;
    }
    
    // Create movement update packet
    const movementUpdate = {
      id: socket.id,
      position: data.position,
      animation: data.animation || 'idle',
      direction: data.direction || 'down',
      timestamp: Date.now()
    };
    
    // Only broadcast to OTHER clients in the room (not back to sender)
    socket.to(player.room).emit('playerMoved', movementUpdate);
  });

  // Send initial positions of all players in room when a player joins
  socket.on('requestPositions', () => {
    const player = players.get(socket.id);
    if (!player || !player.room) return;
    
    console.log(`Player ${socket.id} requested current positions in room ${player.room}`);
    
    const room = rooms.get(player.room);
    if (!room) return;
    
    const positions = [];
    
    room.forEach(playerId => {
      if (playerId !== socket.id) {
        const otherPlayer = players.get(playerId);
        if (otherPlayer) {
          positions.push({
            id: playerId,
            position: otherPlayer.position,
            animation: otherPlayer.animation || 'idle',
            direction: otherPlayer.direction || 'down'
          });
        }
      }
    });
    
    if (positions.length > 0) {
      console.log(`Sending ${positions.length} player positions to ${socket.id}`);
      socket.emit('initialPositions', positions);
    }
  });

  // Handle chat messages
  socket.on('chat', (messageData) => {
    console.log('Chat message received:', messageData);
    const player = players.get(socket.id);
    if (player && player.room) {
      const room = rooms.get(player.room);
      if (room) {
        let messageText, bubbleDistance;
        
        // Handle both string messages and object messages with bubbleDistance
        if (typeof messageData === 'string') {
          messageText = messageData;
          bubbleDistance = null;
        } else {
          messageText = messageData.text;
          bubbleDistance = messageData.bubbleDistance;
        }
        
        const chatMessage = {
          id: socket.id,
          name: player.name,
          role: player.role,
          message: {
            text: messageText,
            bubbleDistance: bubbleDistance
          },
          timestamp: Date.now(),
          bubbleColor: player.bubbleColor, // Include the bubble color
          spriteId: player.spriteId,
          animation: player.animation,
          direction: player.direction
        };
        
        // Emit to all clients in the room
        io.to(player.room).emit('newMessage', chatMessage);
      }
    }
  });

  // Handle background changes
  socket.on('updateBackground', (settings) => {
    console.log('Background update received:', settings.type);
    const player = players.get(socket.id);
    if (player && player.room) {
      const roomId = player.room;
      console.log(`Broadcasting background change to room ${roomId} with ${rooms.get(roomId).size} players`);
      
      // Validate settings
      if (!settings || !settings.type) {
        console.error('Invalid background settings received:', settings);
        return;
      }
      
      try {
        // Check if this is an uploaded image (data URL) 
        const isDataUrl = settings.type === 'image' && 
                          settings.value?.includes('data:image');
                          
        if (isDataUrl) {
          console.log('Processing uploaded image background');
          
          // Ensure the settings value isn't too large (might cause transmission issues)
          if (settings.value.length > 1000000) { // If more than ~1MB
            console.log('Image data URL is very large, this might cause transmission issues');
          }
          
          // Ensure the background settings are complete
          settings = {
            ...settings,
            opacity: settings.opacity ?? 1, 
            blur: settings.blur ?? 0,
            backgroundSize: settings.backgroundSize || 'cover',
            backgroundPosition: settings.backgroundPosition || 'center center'
          };
        }
        
        // Make a clean copy of settings for storage to avoid reference issues
        const settingsToStore = JSON.parse(JSON.stringify(settings));
        
        // Store background settings for the room
        roomBackgrounds.set(roomId, settingsToStore);
        console.log('Background settings stored for room:', roomId);
        
        // Log size of settings for debugging
        const settingsSize = JSON.stringify(settingsToStore).length;
        console.log(`Stored settings (size: ${settingsSize} bytes)`);
        
        // Print all room backgrounds for debugging
        console.log('Current room backgrounds:');
        roomBackgrounds.forEach((bg, rid) => {
          const bgSize = JSON.stringify(bg).length;
          console.log(`- Room ${rid}: (size: ${bgSize} bytes) type: ${bg.type}`);
        });
        
        // Broadcast the background update to all players in the room
        io.to(player.room).emit('backgroundChanged', settings);
        console.log('Background change broadcast completed');
      } catch (error) {
        console.error('Error processing background settings:', error);
      }
    } else {
      console.log('Cannot broadcast background change - player not in a room');
    }
  });

  // Handle voice chat join
  socket.on('join-voice-chat', (data) => {
    const { roomId } = data;
    const userId = socket.id;
    const player = players.get(userId);
    
    if (!player) {
      console.log(`Player ${userId} tried to join voice chat but is not found in players list`);
      return;
    }
    
    if (!player.room || player.room !== roomId) {
      console.log(`Player ${userId} tried to join voice chat in room ${roomId} but is in room ${player.room}`);
      return;
    }
    
    console.log(`Player ${userId} (${player.name}) joined voice chat in room ${roomId}`);
    
    // Add player to voice chat users for this room
    if (!voiceChatUsers.has(roomId)) {
      voiceChatUsers.set(roomId, new Set());
    }
    const roomVoiceUsers = voiceChatUsers.get(roomId);
    roomVoiceUsers.add(userId);
    
    // Convert to object for easier client-side handling
    const playersInVoiceChat = Array.from(roomVoiceUsers).reduce((acc, userId) => {
      acc[userId] = true;
      return acc;
    }, {});
    
    // Log more details about voice chat update with player names
    const voicePlayers = Object.keys(playersInVoiceChat).map(id => {
      const p = players.get(id);
      return p ? `${p.name} (${id})` : id;
    }).join(', ');
    
    console.log(`Voice chat update - Room ${roomId}: ${voicePlayers}`);
    
    // Broadcast to ALL clients in the room (including sender)
    io.to(roomId).emit('voice-chat-update', {
      playersInVoiceChat,
      talkingPlayers: talkingUsers.get(roomId) || {}
    });
    
    // Also send a direct confirmation to the specific client that just joined
    socket.emit('voice-chat-update', {
      playersInVoiceChat,
      talkingPlayers: talkingUsers.get(roomId) || {}
    });
    
    console.log('Broadcasting voice chat update with players:', Object.keys(playersInVoiceChat).join(', '));
    
    // Notify other players in voice chat to initiate WebRTC connection
    socket.to(roomId).emit('user-joined-voice', {
      userId,
      name: player.name
    });
  });
  
  // Handle voice chat leave
  socket.on('leave-voice-chat', (data) => {
    const { roomId } = data;
    const userId = socket.id;
    const player = players.get(userId);
    
    if (!player) {
      console.log(`Player ${userId} tried to leave voice chat but is not found in players list`);
      return;
    }
    
    console.log(`Player ${userId} (${player.name}) left voice chat in room ${roomId}`);
    
    // Remove player from voice chat users
    if (voiceChatUsers.has(roomId)) {
      const roomVoiceUsers = voiceChatUsers.get(roomId);
      roomVoiceUsers.delete(userId);
      
      // Remove talking status
      if (talkingUsers.has(roomId)) {
        const roomTalkingUsers = talkingUsers.get(roomId);
        if (roomTalkingUsers[userId]) {
          delete roomTalkingUsers[userId];
        }
      }
      
      // Convert to object for easier client-side handling
      const playersInVoiceChat = Array.from(roomVoiceUsers).reduce((acc, userId) => {
        acc[userId] = true;
        return acc;
      }, {});
      
      // Log more details about voice chat update
      console.log(`Voice chat update after leave - Room ${roomId}:`, 
        Object.keys(playersInVoiceChat).map(id => {
          const p = players.get(id);
          return p ? `${id} (${p.name})` : id;
        }).join(', ') || 'empty'
      );
      
      // Broadcast to all players in the room that this player left voice chat
      io.to(roomId).emit('voice-chat-update', {
        playersInVoiceChat,
        talkingPlayers: talkingUsers.get(roomId) || {}
      });
      
      console.log('Broadcasting voice chat update after leave with players:', Object.keys(playersInVoiceChat).join(', ') || 'none');
    }
    
    // Notify other players in voice chat to close WebRTC connection
    socket.to(roomId).emit('user-left-voice', {
      userId
    });
  });
  
  // Handle WebRTC signaling
  socket.on('signal-peer', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.room) {
      console.error('Player not found or not in a room for signaling');
      return;
    }
    
    const roomId = player.room;
    const { userId, signal } = data;
    
    // Check if target user exists
    const targetPlayer = players.get(userId);
    if (!targetPlayer) {
      console.error(`Cannot signal user ${userId}: User not found`);
      return;
    }
    
    // Make sure target is in same room
    if (targetPlayer.room !== roomId) {
      console.error(`Cannot signal user ${userId}: Not in the same room`);
      return;
    }
    
    console.log(`WebRTC signal: ${socket.id} → ${userId} [${signal.type || 'candidate'}]`);
    
    // Send the signal directly to the specified user
    socket.to(userId).emit('signal-data', {
      userId: socket.id,
      signal
    });
  });
  
  // Handle talking status updates
  socket.on('talking-status', (data) => {
    const player = players.get(socket.id);
    if (!player || !player.room) return;
    
    const roomId = player.room;
    const { isTalking, isMuted } = data;
    
    // Initialize talking users for room if not exists
    if (!talkingUsers.has(roomId)) {
      talkingUsers.set(roomId, {});
    }
    
    const roomTalkingUsers = talkingUsers.get(roomId);
    
    // Update talking status
    if (isTalking && !isMuted) {
      roomTalkingUsers[socket.id] = true;
    } else {
      delete roomTalkingUsers[socket.id];
    }
    
    // Broadcast talking status to all users in the room
    io.to(roomId).emit('voice-chat-update', {
      talkingPlayers: roomTalkingUsers
    });
  });

  // Clean up when a room becomes empty
  const cleanupEmptyRoom = (roomId) => {
    if (rooms.has(roomId) && rooms.get(roomId).size === 0) {
      console.log('Removing empty room:', roomId);
      rooms.delete(roomId);
      roomBackgrounds.delete(roomId); // Also clean up background settings
    }
  };

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    const player = players.get(socket.id);
    if (player && player.room) {
      const roomId = player.room;
      
      // Remove player from the room
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket.id);
        
        // Notify other players in the room
        socket.to(roomId).emit('playerLeft', {
          id: socket.id,
          name: player.name
        });
        
        // Check if room is empty and clean up if needed
        if (room.size === 0) {
          cleanupEmptyRoom(roomId);
        }
      }
      
      // Remove player from voice chat users if they were in voice chat
      if (voiceChatUsers.has(roomId)) {
        const roomVoiceUsers = voiceChatUsers.get(roomId);
        if (roomVoiceUsers.has(socket.id)) {
          roomVoiceUsers.delete(socket.id);
          
          // Notify other clients about the updated voice chat users
          const playersInVoiceChat = Array.from(roomVoiceUsers).reduce((acc, userId) => {
            acc[userId] = true;
            return acc;
          }, {});
          
          io.to(roomId).emit('voice-chat-update', {
            playersInVoiceChat
          });
          
          // Notify other clients in voice chat about the user who left
          socket.to(roomId).emit('user-left-voice', {
            userId: socket.id
          });
        }
      }
      
      // Remove from talking users if they were talking
      if (talkingUsers.has(roomId)) {
        const roomTalkingUsers = talkingUsers.get(roomId);
        if (roomTalkingUsers[socket.id]) {
          delete roomTalkingUsers[socket.id];
          
          io.to(roomId).emit('voice-chat-update', {
            talkingPlayers: roomTalkingUsers
          });
        }
      }
    }
    
    // Remove player from the players map
    players.delete(socket.id);
  });

  // Debug: list all rooms
  socket.on('listRooms', () => {
    const roomList = [];
    rooms.forEach((players, roomId) => {
      roomList.push({
        roomId,
        playerCount: players.size
      });
    });
    socket.emit('roomList', roomList);
  });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and accessible via all network interfaces`);
  console.log(`Try connecting from other devices using http://<your-ip-address>:${PORT}`);
}); 