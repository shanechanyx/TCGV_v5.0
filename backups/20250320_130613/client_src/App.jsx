import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import BackgroundManager from './BackgroundManager';
import './BackgroundManager.css';
import { defaultBackgroundSettings } from './BackgroundSettings';
import SpriteManager from './SpriteManager';
import CharacterSelector from './CharacterSelector';
import { getSpriteConfigById } from './SpriteConfigs';
import VoiceChat from './VoiceChat';
import PlayerList from './PlayerList';

// Available bubble colors for selection
const bubbleColors = [
  { name: 'Blue', value: '#2c5282' },
  { name: 'Green', value: '#276749' },
  { name: 'Purple', value: '#553c9a' },
  { name: 'Red', value: '#9b2c2c' },
  { name: 'Orange', value: '#c05621' },
  { name: 'Teal', value: '#285e61' }
];

// Movement speed for keyboard controls - increased for better movement
const MOVEMENT_SPEED = 5;

// Base distance for chat bubbles from player square
const BASE_BUBBLE_DISTANCE = 45;
// Additional distance per line of text (approx)
const DISTANCE_PER_LINE = 16;
// Max lines to consider for distance calculation
const MAX_LINES = 4;

function App() {
  const [socket, setSocket] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [roomId, setRoomId] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(true);
  const [error, setError] = useState('');
  const [bubbleColor, setBubbleColor] = useState('#2c5282'); // Default bubble color
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false); // State for emoji picker
  const [playerPositions, setPlayerPositions] = useState({}); // Track player positions
  const [playerMessages, setPlayerMessages] = useState({}); // Track player chat messages
  const [isDragging, setIsDragging] = useState(false); // Track drag state
  const [currentPlayer, setCurrentPlayer] = useState(null); // Track current player being dragged
  const [keysPressed, setKeysPressed] = useState({}); // Track keyboard keys pressed
  const [backgroundSettings, setBackgroundSettings] = useState(defaultBackgroundSettings); // Background settings
  const [textHeight, setTextHeight] = useState(0); // Track approximate text height
  const [spriteId, setSpriteId] = useState('8bit'); // Default sprite type
  const [playerAnimations, setPlayerAnimations] = useState({}); // Track player animation states
  const [playerDirections, setPlayerDirections] = useState({}); // Track player directions
  const [playersInVoiceChat, setPlayersInVoiceChat] = useState({}); // Track players in voice chat
  const [talkingPlayers, setTalkingPlayers] = useState({}); // Track players currently talking
  
  const gameAreaRef = useRef(null); // Reference to the game area for positioning
  const timeoutsRef = useRef({}); // Store timeouts in a ref
  const textMeasurerRef = useRef(null); // Reference to measure text size
  
  // Calculate bubble distance based on text content
  const calculateBubbleDistance = (text) => {
    if (!text) return BASE_BUBBLE_DISTANCE;
    
    // Estimate number of lines
    const avgCharsPerLine = 20; // Approximate chars per line in the bubble
    const lines = Math.min(
      Math.ceil(text.length / avgCharsPerLine), 
      MAX_LINES
    );
    
    return BASE_BUBBLE_DISTANCE + ((lines - 1) * DISTANCE_PER_LINE);
  };
  
  // Calculate bubble position based on message index and text content
  const calculateBubblePosition = (index, text) => {
    // Base distance from the player - increased to ensure bubbles appear above player name
    const baseDistance = calculateBubbleDistance(text) + 25; // Added 25px extra margin
    
    // Adjust position based on message index (stack messages)
    // First message (index 0) is closest to the player
    const position = -(baseDistance + (index * 60));
    
    return `${position}px`;
  };
  
  // Measure text as user types
  useEffect(() => {
    if (textMeasurerRef.current) {
      // Update the content of the measurer
      textMeasurerRef.current.textContent = message || 'Type a message';
      // Get the height
      const height = textMeasurerRef.current.clientHeight;
      setTextHeight(height);
    }
  }, [message]);
  
  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); // Prevent scrolling with arrow keys
        setKeysPressed(prev => ({ ...prev, [e.key]: true }));
      }
    };
    
    const handleKeyUp = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setKeysPressed(prev => ({ ...prev, [e.key]: false }));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts when component unmounts
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);
  
  // Handle background settings change
  const handleApplyBackground = (settings) => {
    console.log('Applying background settings:', settings?.type, settings?.value?.substring?.(0, 30) + '...');
    
    // Store locally first using a functional update to ensure we're working with latest state
    setBackgroundSettings(prevSettings => {
      console.log('Previous background settings:', prevSettings?.type);
      return settings;
    });
    
    // Special handling for uploaded images to ensure they're shared
    const isUploadedImage = settings.type === 'image' && 
                           settings.value?.startsWith('url(data:image');
                           
    if (isUploadedImage) {
      console.log('Handling uploaded image background');
    }
    
    // Broadcast background change to all users in the room
    if (socket && inRoom) {
      console.log('Sending background update to server');
      socket.emit('updateBackground', settings);
    }
  };

  // Calculate background style based on settings
  const getBackgroundStyle = () => {
    const { type, value, opacity, blur, backgroundSize, backgroundPosition } = backgroundSettings;
    
    // For debugging
    console.log('Generating background style via React:',
      JSON.stringify({
        type,
        valuePreview: value?.substring?.(0, 30) + '...',
        opacity,
        blur,
        backgroundSize,
        backgroundPosition
      })
    );
    
    let style = {
      background: value,
      backgroundSize: backgroundSize || 'cover',
      backgroundPosition: backgroundPosition || 'center center'
    };
    
    if (type === 'image') {
      style.opacity = opacity;
      style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    }
    
    return style;
  };

  // Determine animation based on movement
  const determineAnimation = (previousPosition, newPosition) => {
    // If position changed, use walk animation
    if (Math.abs(previousPosition.x - newPosition.x) > 2 || 
        Math.abs(previousPosition.y - newPosition.y) > 2) {
      return 'walk';
    }
    // If not moving or very small movement, use idle animation
    return 'idle';
  };

  // Add this function to determine direction based on movement
  const determineDirection = (previousPosition, newPosition) => {
    // Calculate the most significant direction of movement
    const deltaX = newPosition.x - previousPosition.x;
    const deltaY = newPosition.y - previousPosition.y;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else if (deltaY !== 0) {
      return deltaY > 0 ? 'down' : 'up';
    }
    
    // If no movement, keep previous direction or default to down
    return 'down';
  };

  // Socket handler for player movement events - simplified for reliability
  useEffect(() => {
    if (!socket) return;
    
    console.log('Setting up player movement handlers');
    
    // Handle ALL player movement events - critical for real-time updates
    const handlePlayerMoved = (data) => {
      // Skip invalid data
      if (!data || !data.id || !data.position) {
        console.error('Invalid player movement data:', data);
        return;
      }
      
      // Only process movements from OTHER players (not self)
      if (data.id === socket.id) return;
      
      console.log(`Player ${data.id.slice(0,6)} moved to:`, data.position);
      
      // Update DOM directly for immediate visual feedback
      const playerElement = document.getElementById(`player-${data.id}`);
      if (playerElement) {
        playerElement.style.left = `${data.position.x}px`;
        playerElement.style.top = `${data.position.y}px`;
      } else {
        console.warn(`Player element not found: player-${data.id}`);
      }
      
      // Update React state for persistence
      setPlayerPositions(prev => ({
        ...prev,
        [data.id]: data.position
      }));
      
      // Update animation and direction
      setPlayerAnimations(prev => ({
        ...prev,
        [data.id]: data.animation || 'idle'
      }));
      
      setPlayerDirections(prev => ({
        ...prev,
        [data.id]: data.direction || 'down'
      }));
    };
    
    // Remove any existing listeners to prevent duplicates
    socket.off('playerMoved');
    
    // Set up event handler
    socket.on('playerMoved', handlePlayerMoved);
    
    return () => {
      socket.off('playerMoved', handlePlayerMoved);
    };
  }, [socket]);
  
  // Update position directly with improved broadcasting
  const broadcastPosition = (position, animation = 'idle', direction = 'down') => {
    if (!socket) return;
    
    // First broadcast to server - we'll get the update back from the server
    socket.emit('updatePosition', {
      position,
      animation,
      direction
    });
    
    console.log(`Broadcasting position to server:`, position);
  };

  // Keyboard movement handler - improved for continuous movement
  useEffect(() => {
    if (!inRoom || !socket) return;
    
    let animationFrameId;
    let lastSentPosition = null;
    let lastSentTime = 0;
    let lastAnimation = 'idle';
    
    const moveSquare = () => {
      if (Object.values(keysPressed).some(key => key) && gameAreaRef.current && socket) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        const currentPosition = playerPositions[socket.id] || { x: 50, y: 50 };
        let { x, y } = currentPosition;
        let hasMoved = false;
        
        // Calculate new position based on key presses - increased speed for better movement
        const moveAmount = 8; // Increased movement speed
        
        if (keysPressed.ArrowUp) {
          y = Math.max(0, y - moveAmount);
          hasMoved = true;
        }
        if (keysPressed.ArrowDown) {
          y = Math.min(rect.height - 100, y + moveAmount);
          hasMoved = true;
        }
        if (keysPressed.ArrowLeft) {
          x = Math.max(0, x - moveAmount);
          hasMoved = true;
        }
        if (keysPressed.ArrowRight) {
          x = Math.min(rect.width - 100, x + moveAmount);
          hasMoved = true;
        }
        
        if (hasMoved) {
          const newPosition = { x, y };
          
          // Always update DOM for smooth local movement
          const playerElement = document.getElementById(`player-${socket.id}`);
          if (playerElement) {
            playerElement.style.left = `${x}px`;
            playerElement.style.top = `${y}px`;
          }
          
          // Update React state
          setPlayerPositions(prev => ({
            ...prev,
            [socket.id]: newPosition
          }));
          
          // Calculate animation and direction
          const animation = 'walk'; // Always use walk animation when moving
          const direction = determineDirection(currentPosition, newPosition);
          
          // Update animation states
          setPlayerAnimations(prev => ({
            ...prev,
            [socket.id]: animation
          }));
          
          setPlayerDirections(prev => ({
            ...prev,
            [socket.id]: direction
          }));
          
          // Throttle server updates to reduce network traffic
          const now = Date.now();
          const shouldSendUpdate = 
            !lastSentPosition || 
            now - lastSentTime > 33 || // Send about 30 times per second
            Math.abs(lastSentPosition.x - x) > 10 || 
            Math.abs(lastSentPosition.y - y) > 10 ||
            lastAnimation !== animation; // Send when animation changes
            
          if (shouldSendUpdate) {
            // Send to server
            socket.emit('updatePosition', {
              position: newPosition,
              animation,
              direction
            });
            
            // Update last sent position and time
            lastSentPosition = { ...newPosition };
            lastSentTime = now;
            lastAnimation = animation;
          }
        } else {
          // If not moving, set animation to idle
          const currentAnimation = playerAnimations[socket.id];
          if (currentAnimation === 'walk') {
            const animation = 'idle';
            setPlayerAnimations(prev => ({
              ...prev,
              [socket.id]: animation
            }));
            
            // Send the idle animation update
            const now = Date.now();
            if (now - lastSentTime > 100 || lastAnimation !== animation) {
              socket.emit('updatePosition', {
                position: currentPosition,
                animation,
                direction: playerDirections[socket.id] || 'down'
              });
              lastAnimation = animation;
              lastSentTime = now;
            }
          }
        }
      } else if (playerAnimations[socket.id] === 'walk') {
        // If keys are released, set animation back to idle
        const animation = 'idle';
        setPlayerAnimations(prev => ({
          ...prev,
          [socket.id]: animation
        }));
        
        // Send the idle animation update
        if (socket) {
          socket.emit('updatePosition', {
            position: playerPositions[socket.id] || { x: 50, y: 50 },
            animation,
            direction: playerDirections[socket.id] || 'down'
          });
        }
      }
      
      animationFrameId = requestAnimationFrame(moveSquare);
    };
    
    animationFrameId = requestAnimationFrame(moveSquare);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [keysPressed, playerPositions, playerAnimations, playerDirections, socket, inRoom]);
  
  // Mouse/touch dragging handler - improved for free movement
  const handleMouseMove = (e) => {
    if (isDragging && currentPlayer && gameAreaRef.current && currentPlayer === socket.id) {
      const rect = gameAreaRef.current.getBoundingClientRect();
      let x, y;
      
      // Check if this is a touch event or mouse event
      if (e.touches) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      }
      
      // Make sure the player stays within the interactive area
      x = Math.max(0, Math.min(rect.width - 40, x));
      y = Math.max(0, Math.min(rect.height - 40, y));
      
      const newPosition = { x, y };
      
      // Always update DOM for immediate visual feedback
      const playerElement = document.getElementById(`player-${socket.id}`);
      if (playerElement) {
        playerElement.style.left = `${x}px`;
        playerElement.style.top = `${y}px`;
      }
      
      // Get current position for calculations
      const currentPosition = playerPositions[socket.id] || { x: 50, y: 50 };
      
      // Send updates to server for significant movements
      if (!currentPosition || 
          Math.abs(currentPosition.x - x) > 2 || 
          Math.abs(currentPosition.y - y) > 2) {
        
        const animation = determineAnimation(currentPosition, newPosition);
        const direction = determineDirection(currentPosition, newPosition);
        
        // Send to server
        socket.emit('updatePosition', {
          position: newPosition,
          animation,
          direction
        });
        
        // Update React state
        setPlayerPositions(prev => ({
          ...prev,
          [socket.id]: newPosition
        }));
      }
    }
  };

  // Handle mouse/touch events for dragging player squares
  const handleMouseDown = (e, playerId) => {
    if (playerId === socket?.id) { // Only allow dragging your own square
      setIsDragging(true);
      setCurrentPlayer(playerId);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setCurrentPlayer(null);
  };
  
  // Initialize socket with better error handling and reconnection options
  useEffect(() => {
    // Set up socket.io with reconnection options
    const newSocket = io('http://192.168.68.51:3001', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    setSocket(newSocket);
    
    // Set up debug listeners
    const debugSocketEvents = (socket) => {
      const originalEmit = socket.emit;
      socket.emit = function() {
        console.log('🔵 SOCKET EMIT:', arguments[0], arguments[1]);
        return originalEmit.apply(socket, arguments);
      };
      
      // Log all incoming events except frequent movement events
      const onevent = socket.onevent;
      socket.onevent = function(packet) {
        const args = packet.data || [];
        if (args[0] !== 'playerMoved') { // Don't log frequent movement events
          console.log('🟢 SOCKET RECEIVE:', args[0], args.slice(1));
        }
        onevent.call(this, packet);
      };
    };
    
    debugSocketEvents(newSocket);
    
    // Socket event listeners
    newSocket.on('connect', () => {
      console.log('Connected to server with ID:', newSocket.id);
      
      // If we were in a room before reconnection, rejoin it
      if (inRoom && roomId) {
        console.log('Attempting to rejoin room after connection');
        newSocket.emit('joinRoom', {
          name: name,
          roomId: roomId,
          role: role,
          bubbleColor: bubbleColor,
          spriteId: spriteId
        });
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server. Please try again.');
    });

    newSocket.on('error', (err) => {
      console.error('Server error:', err);
      setError(err);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, try to reconnect
        newSocket.connect();
      }
    });

    newSocket.on('playerJoined', (player) => {
      console.log('Player joined:', player);
      setPlayers(prev => [...prev.filter(p => p.id !== player.id), player]);
      
      // Set initial position for new player
      setPlayerPositions(prev => ({
        ...prev,
        [player.id]: player.position || {
          x: 50 + (Object.keys(prev).length * 100),
          y: 100
        }
      }));
    });

    newSocket.on('playerLeft', (data) => {
      console.log('Player left:', data);
      setPlayers(prev => prev.filter(p => p.id !== data.id));
      
      // Remove position for player who left
      setPlayerPositions(prev => {
        const newPositions = {...prev};
        delete newPositions[data.id];
        return newPositions;
      });
      
      // Remove chat message for player who left
      setPlayerMessages(prev => {
        const newMessages = {...prev};
        delete newMessages[data.id];
        return newMessages;
      });
      
      // Clear any timeouts for this player
      if (timeoutsRef.current[data.id]) {
        clearTimeout(timeoutsRef.current[data.id]);
        delete timeoutsRef.current[data.id];
      }
    });

    newSocket.on('newMessage', (msg) => {
      console.log('New message:', msg);
      
      // Extract text and bubble distance from the message
      let messageText, bubbleDistance;
      
      if (typeof msg.message === 'object' && msg.message !== null) {
        messageText = msg.message.text;
        bubbleDistance = msg.message.bubbleDistance;
      } else {
        messageText = msg.message;
        bubbleDistance = calculateBubbleDistance(messageText);
      }
      
      // Add to chat history
      setMessages(prev => [...prev, {
        ...msg,
        message: messageText
      }]);
      
      // Update the messages array for the specific player (keep last 3)
      setPlayerMessages(prev => {
        // Get previous messages or empty array
        const prevMessages = prev[msg.id] || [];
        
        // Generate unique ID for this message
        const messageId = Date.now();
        
        // Create new messages array with the latest message added (limit to 3)
        const newMessages = [...prevMessages, {
          text: messageText,
          id: messageId,
          timestamp: Date.now(),
          fadeOut: false,
          bubbleDistance: bubbleDistance
        }].slice(-3);
        
        // Create new state with updated messages
        const newState = {
          ...prev,
          [msg.id]: newMessages
        };
        
        // Set a timeout for this specific message
        setTimeout(() => {
          setPlayerMessages(current => {
            // If player doesn't exist in current state, no need to update
            if (!current[msg.id]) return current;
            
            // Find the message by ID
            const playerMessages = current[msg.id];
            const messageIndex = playerMessages.findIndex(m => m.id === messageId);
            
            // If message is not found, no need to update
            if (messageIndex === -1) return current;
            
            // First set fadeOut to true for animation
            const updatedMessages = [...playerMessages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              fadeOut: true
            };
            
            // Return updated state with the fading message
            return {
              ...current,
              [msg.id]: updatedMessages
            };
          });
          
          // Remove the message after the fade animation completes
          setTimeout(() => {
            setPlayerMessages(current => {
              // If player doesn't exist in current state, no need to update
              if (!current[msg.id]) return current;
              
              // Remove the message by ID
              const updatedMessages = current[msg.id].filter(m => m.id !== messageId);
              
              // If no messages left, remove the player entry
              if (updatedMessages.length === 0) {
                const newState = { ...current };
                delete newState[msg.id];
                return newState;
              }
              
              // Return updated state without the removed message
              return {
                ...current,
                [msg.id]: updatedMessages
              };
            });
          }, 500); // Wait for fade animation to complete (500ms)
          
        }, 3000); // Wait 3 seconds before starting fade out
        
        return newState;
      });
    });

    // Listen for background changes from other users
    newSocket.on('backgroundChanged', (settings) => {
      console.log('🔵 Background changed by another user:', 
        settings?.type, 
        settings?.value?.substring?.(0, 30) + '...',
        'data size:', settings?.value?.length || 0, 'bytes'
      );
      
      // Force-apply the background
      forceApplyBackground(settings);
    });

    newSocket.on('roomList', (list) => {
      console.log('Available rooms:', list);
    });

    newSocket.on('voice-chat-update', handleVoiceChatUpdate);

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.disconnect();
      
      // Clear all timeouts when socket disconnects
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Socket cleanup effect
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('Component unmounting, disconnecting socket');
        socket.disconnect();
      }
    };
  }, [socket]);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    
    if (!name.trim() || !roomId.trim() || !role) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    
    if (socket) {
      socket.emit('joinRoom', {
        name: name.trim(),
        roomId: roomId.trim(),
        role,
        bubbleColor,
        spriteId // Send sprite ID to server
      });
      
      setInRoom(true);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      // Calculate optimal bubble distance based on message content
      const bubbleDistance = calculateBubbleDistance(message.trim());
      
      // Send message with calculated distance
      socket.emit('chat', {
        text: message.trim(),
        bubbleDistance
      });
      
      setMessage('');
    }
  };

  // Auto-scroll chat on new messages
  const messagesEndRef = React.useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleBackToHome = () => {
    setInRoom(false);
    setMessages([]);
  };

  const handleEmojiClick = (emoji) => {
    setMessage(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  // Room joining and position initialization
  useEffect(() => {
    if (!socket) return;
    
    // Force-apply background to DOM directly
    const forceApplyBackground = (settings) => {
      if (!settings || !settings.type || !settings.value) {
        console.error("Invalid background settings to force-apply:", settings);
        return false;
      }
      
      console.log("FORCE APPLYING BACKGROUND:", settings.type, settings.value.substring(0, 30) + "...");
      
      // Try to apply immediately and again after delays
      const applyToDOM = () => {
        try {
          const gameContent = document.querySelector('.hero-game-content');
          if (!gameContent) {
            console.error("Game content element not found for force apply");
            return false;
          }
          
          const bgLayer = gameContent.querySelector('.game-background-layer');
          if (!bgLayer) {
            console.error("Background layer element not found for force apply");
            return false;
          }
          
          // Direct DOM manipulation for immediate effect
          bgLayer.style.background = settings.value;
          bgLayer.style.backgroundSize = settings.backgroundSize || 'cover';
          bgLayer.style.backgroundPosition = settings.backgroundPosition || 'center';
          
          if (settings.type === 'image') {
            bgLayer.style.opacity = settings.opacity !== undefined ? settings.opacity : 1;
            bgLayer.style.filter = settings.blur && settings.blur > 0 ? `blur(${settings.blur}px)` : 'none';
          }
          
          // Add data attribute for debugging
          bgLayer.dataset.forcedBackground = 'true';
          bgLayer.dataset.forcedTime = new Date().toISOString();
          
          console.log("✅ Background FORCE-APPLIED to DOM successfully");
          return true;
        } catch (error) {
          console.error("Error in force-applying background:", error);
          return false;
        }
      };
      
      // Try immediately
      const success = applyToDOM();
      
      // And try with increasing delays (more aggressive than the normal approach)
      if (!success) {
        [50, 100, 250, 500, 1000, 2000].forEach(delay => {
          setTimeout(applyToDOM, delay);
        });
      }
      
      // Also update the state for normal React rendering
      setBackgroundSettings(settings);
      
      return success;
    };
    
    // Handle room joining
    const handleRoomJoined = (data) => {
      console.log('Joined room:', data);
      setInRoom(true);
      
      // Initialize positions for all players
      const positions = {};
      data.players.forEach((player, index) => {
        positions[player.id] = player.position || {
          x: 50 + (index * 100),
          y: 100
        };
      });
      setPlayerPositions(positions);
      setPlayers(data.players);
      setError('');
      
      // Apply background settings if available
      if (data.backgroundSettings) {
        console.log('🔴 RECEIVED BACKGROUND ON ROOM JOIN:', 
          JSON.stringify({
            type: data.backgroundSettings.type,
            valuePreview: data.backgroundSettings.value?.substring(0, 50) + '...',
            valueLength: data.backgroundSettings.value?.length || 0,
            opacity: data.backgroundSettings.opacity,
            blur: data.backgroundSettings.blur
          })
        );
        
        // Directly force-apply background 
        setTimeout(() => {
          forceApplyBackground(data.backgroundSettings);
        }, 200);
      } else {
        console.log('❌ No background settings received from server during room join');
      }
      
      // Request initial positions
      socket.emit('requestPositions');
    };
    
    // Handle initial positions
    const handleInitialPositions = (positions) => {
      console.log('Received initial positions:', positions);
      
      if (!positions || !positions.length) return;
      
      // Update positions immediately in DOM
      positions.forEach(player => {
        const playerElement = document.getElementById(`player-${player.id}`);
        if (playerElement) {
          playerElement.style.left = `${player.position.x}px`;
          playerElement.style.top = `${player.position.y}px`;
        }
        
        // Then update React state
        setPlayerPositions(prev => ({
          ...prev,
          [player.id]: player.position
        }));
        
        setPlayerAnimations(prev => ({
          ...prev,
          [player.id]: player.animation || 'idle'
        }));
        
        setPlayerDirections(prev => ({
          ...prev,
          [player.id]: player.direction || 'down'
        }));
      });
    };
    
    // Clear existing listeners
    socket.off('roomJoined');
    socket.off('initialPositions');
    socket.off('backgroundChanged');
    
    // Set up event handlers
    socket.on('roomJoined', handleRoomJoined);
    socket.on('initialPositions', handleInitialPositions);
    
    // Listen for background changes from other users
    socket.on('backgroundChanged', (settings) => {
      console.log('🔵 Background changed by another user:', 
        settings?.type, 
        settings?.value?.substring?.(0, 30) + '...',
        'data size:', settings?.value?.length || 0, 'bytes'
      );
      
      // Force-apply the background immediately
      forceApplyBackground(settings);
    });
    
    return () => {
      socket.off('roomJoined', handleRoomJoined);
      socket.off('initialPositions', handleInitialPositions);
      socket.off('backgroundChanged');
    };
  }, [socket]);

  // Handle voice chat player status update
  const handleVoiceChatUpdate = (data) => {
    if (data.talkingPlayers) {
      setTalkingPlayers(data.talkingPlayers);
    }
    
    if (data.playersInVoiceChat) {
      setPlayersInVoiceChat(data.playersInVoiceChat);
    }
  };
  
  // Check if a player is currently talking
  const isPlayerTalking = (playerId) => {
    return talkingPlayers[playerId] || false;
  };
  
  // Check if a player is in voice chat
  const isPlayerInVoiceChat = (playerId) => {
    return playersInVoiceChat[playerId] || false;
  };

  // Get text-only players count
  const getTextOnlyPlayersCount = () => {
    return players.filter(player => !playersInVoiceChat[player.id]).length;
  };
  
  // Get voice chat players count
  const getVoiceChatPlayersCount = () => {
    return Object.keys(playersInVoiceChat).length;
  };

  // Display login screen if not in a room
  if (!inRoom) {
    return (
      <div className="hero-login-container">
        <div className="hero-card">
          <div className="hero-card-header">
            <h1>Chat Room</h1>
            <div className="hero-subtitle">Select your preferences and join a room</div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleJoinRoom} className="hero-form">
            <div className="hero-form-group">
              <label>Your Name</label>
              <div className="hero-input-wrapper">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="hero-input"
                />
                <div className="hero-input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="hero-form-group">
              <label>Select Role</label>
              <div className="hero-select-wrapper">
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                  className="hero-select"
                >
                  <option value="">Select a role</option>
                  <option value="roleA">Role A</option>
                  <option value="roleB">Role B</option>
                </select>
                <div className="hero-select-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path d="M15.75 8.25a.75.75 0 01.75.75c0 1.12-.492 2.126-1.27 2.812a.75.75 0 11-.992-1.124A2.243 2.243 0 0015 9a.75.75 0 01.75-.75z" />
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM4.575 15.6a8.25 8.25 0 009.348 4.425 1.966 1.966 0 00-1.84-1.275.983.983 0 01-.97-.822l-.073-.437c-.094-.565.25-1.11.8-1.267l.99-.282c.427-.123.783-.418.982-.816l.036-.073a1.453 1.453 0 012.328-.377L16.5 15h.628a2.25 2.25 0 011.983 1.186 8.25 8.25 0 00-6.345-12.4c.044.262.18.503.389.676l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.575 15.6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="hero-form-group">
              <label>Chat Bubble Color</label>
              <div className="hero-color-picker">
                {bubbleColors.map(color => (
                  <div 
                    key={color.value}
                    className={`hero-color-option ${bubbleColor === color.value ? 'active' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setBubbleColor(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
              <div className="hero-color-preview">
                <div className="hero-preview-bubble" style={{ backgroundColor: bubbleColor }}>
                  <span>Preview</span>
                </div>
              </div>
            </div>
            
            <div className="hero-form-group">
              <label>Room Options</label>
              <div className="hero-toggle-buttons">
                <button
                  type="button"
                  className={`hero-toggle-button ${isCreatingRoom ? 'active' : ''}`}
                  onClick={() => setIsCreatingRoom(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                  </svg>
                  Create Room
                </button>
                <button
                  type="button"
                  className={`hero-toggle-button ${!isCreatingRoom ? 'active' : ''}`}
                  onClick={() => setIsCreatingRoom(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                  </svg>
                  Join Room
                </button>
              </div>
            </div>
            
            <div className="hero-form-group">
              <label>Room Code</label>
              <div className="hero-input-wrapper">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder={isCreatingRoom ? "Enter new room code" : "Enter existing room code"}
                  className="hero-input"
                />
                <div className="hero-input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.437-.695z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <button type="submit" className="hero-button">
              {isCreatingRoom ? 'Create Room' : 'Join Room'}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-button-icon">
                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
          
          {/* Add character selector */}
          <CharacterSelector 
            selectedSpriteId={spriteId}
            onSelectSprite={(id) => setSpriteId(id)}
          />
        </div>
      </div>
    );
  }

  // Game room with chat
  const isVoiceChatEnabled = true; // Voice chat is always enabled at the app level

  return (
    <div className={`hero-room-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isChatCollapsed ? 'chat-collapsed' : ''} ${isSidebarCollapsed && isChatCollapsed ? 'both-collapsed' : ''}`}>
      <div className={`hero-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="hero-sidebar-header">
          <h2>Room: {roomId}</h2>
          <button 
            className="hero-collapse-button" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand player list" : "Collapse player list"}
          >
            {isSidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
        {!isSidebarCollapsed && (
          <div className="hero-player-list">
            <div className="hero-section-title">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" />
                <path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.764-.44l-.115-.04a.563.563 0 01-.373-.487l-.01-.121a3.75 3.75 0 013.57-4.047zM20.226 19.389a8.287 8.287 0 00-1.308-5.135 3.75 3.75 0 013.57 4.047l-.01.121a.563.563 0 01-.373.486l-.115.04c-.567.2-1.156.349-1.764.441z" />
              </svg>
              <h3>Participants</h3>
            </div>
            <PlayerList 
              players={players}
              playersInVoiceChat={playersInVoiceChat}
              talkingPlayers={talkingPlayers}
              currentPlayerId={socket?.id}
              socket={socket}
              roomId={roomId}
              isVoiceChatEnabled={isVoiceChatEnabled}
            />
            <button 
              className="hero-button hero-back-home-button" 
              onClick={handleBackToHome}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-button-icon">
                <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
              </svg>
              Back to Home
            </button>
          </div>
        )}
      </div>
      
      <div className={`hero-main-area ${isSidebarCollapsed && isChatCollapsed ? 'fullwidth' : isSidebarCollapsed || isChatCollapsed ? 'expanded' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isChatCollapsed ? 'chat-collapsed' : ''}`}>
        <div className="hero-game-header">
          <h2>Interactive Area</h2>
          <div className="hero-controls-info">
            <p>Use arrow keys or drag to move your square</p>
          </div>
        </div>
        <div 
          className="hero-game-content" 
          ref={gameAreaRef}
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Separate background layer with opacity and blur effects */}
          <div 
            className="game-background-layer" 
            style={getBackgroundStyle()}
            data-testid="game-background-layer"
            data-background-type={backgroundSettings?.type || 'none'}
            data-background-applied={backgroundSettings ? 'true' : 'false'}
            aria-hidden="true"
          ></div>
          
          {/* Text measurer for calculating optimal bubble position */}
          <div 
            ref={textMeasurerRef}
            className="text-measurer"
            aria-hidden="true"
          ></div>
          
          {/* Interactive area with user sprites */}
          <div className="interactive-area">
            {players.map(player => {
              const position = playerPositions[player.id] || { x: 50, y: 50 };
              const chatMessages = playerMessages[player.id] || [];
              const animation = playerAnimations[player.id] || 'idle';
              const direction = playerDirections[player.id] || 'down';
              const playerSpriteId = player.spriteId || '8bit'; // Use player's sprite or default
              
              return (
                <div 
                  key={player.id}
                  id={`player-${player.id}`}
                  data-player-id={player.id}
                  className={`player-with-sprite ${player.id === socket?.id ? 'my-player' : 'other-player'}`}
                  style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    position: 'absolute',
                    cursor: player.id === socket?.id ? 'grab' : 'default',
                    zIndex: player.id === socket?.id ? 10 : 5
                  }}
                  onMouseDown={(e) => handleMouseDown(e, player.id)}
                  onTouchStart={(e) => handleMouseDown(e, player.id)}
                >
                  <div className="player-name">
                    {player.name}
                    {/* Voice chat indicator */}
                    {isPlayerInVoiceChat(player.id) && (
                      <span 
                        className="voice-chat-indicator" 
                        title="In voice chat"
                      >🎤</span>
                    )}
                    {/* Talking indicator */}
                    {isPlayerTalking(player.id) && (
                      <span 
                        className="talking-indicator" 
                        title="Talking"
                      ></span>
                    )}
                  </div>
                  <SpriteManager 
                    spriteSheet={getSpriteConfigById(playerSpriteId).defaultSprite}
                    animation={animation}
                    direction={direction}
                    config={getSpriteConfigById(playerSpriteId)}
                    size={80}
                    tintColor={playerSpriteId === 'character1' || playerSpriteId === 'character2' ? (player.bubbleColor || '#4a90e2') : ''}
                  />
                  <div className="sprite-shadow"></div>
                  
                  {/* Chat bubbles */}
                  {chatMessages.map((msg, index) => {
                    if (index < 3) { // Show max 3 messages
                      return (
                        <div
                          key={index}
                          className="player-chat-bubble"
                          data-message-index={index}
                          style={{
                            backgroundColor: player.bubbleColor || '#4a90e2',
                            top: calculateBubblePosition(index, msg.text)
                          }}
                        >
                          {msg.text}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })}
          </div>
          
          {/* Background settings manager */}
          <BackgroundManager onApplyBackground={handleApplyBackground} />
        </div>
      </div>
      
      <div className={`hero-chat ${isChatCollapsed ? 'collapsed' : ''}`}>
        <div className="hero-chat-header">
          <div className="hero-chat-title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
            </svg>
            <h3>Chat</h3>
          </div>
          <button 
            className="hero-collapse-button" 
            onClick={() => setIsChatCollapsed(!isChatCollapsed)}
            title={isChatCollapsed ? "Expand chat" : "Collapse chat"}
          >
            {isChatCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                <path fillRule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
        {!isChatCollapsed && (
          <>
            <div className="hero-messages">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`hero-message ${msg.id === socket?.id ? 'hero-message-own' : ''}`}
                >
                  <div className="hero-message-avatar" style={{backgroundColor: msg.bubbleColor || '#4a90e2'}}>
                    {msg.name[0].toUpperCase()}
                  </div>
                  <div 
                    className="hero-message-bubble"
                    style={{
                      backgroundColor: msg.bubbleColor || '#333',
                      '--bubble-color': msg.bubbleColor || '#333'
                    }}
                  >
                    <div className="hero-message-header">
                      <span className="hero-message-name">{msg.name}</span>
                      <span className="hero-message-role">{msg.role === 'roleA' ? 'Role A' : 'Role B'}</span>
                    </div>
                    <div className="hero-message-content">{msg.message}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="hero-chat-input">
              <div className="hero-input-wrapper">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="hero-input"
                />
              </div>
              <div className="hero-chat-buttons">
                <button 
                  type="button" 
                  className="hero-emoji-button"
                  onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-button-icon">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 00-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 01-.189-.866c0-.298.059-.605.189-.866zm-4.34 7.964a.75.75 0 01-1.061-1.06 5.236 5.236 0 013.73-1.538 5.236 5.236 0 013.695 1.538.75.75 0 11-1.061 1.06 3.736 3.736 0 00-2.639-1.098 3.736 3.736 0 00-2.664 1.098z" clipRule="evenodd" />
                  </svg>
                </button>
                <button type="submit" className="hero-chat-button">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-button-icon">
                    <path d="M3.478 2.404a.75.75 0 0 0 0 .941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                </button>
              </div>
              {isEmojiPickerOpen && (
                <div className="hero-emoji-picker">
                  <div className="hero-emoji-grid">
                    {['😀', '😂', '😊', '😍', '🥰', '😎', '😢', '😭', '🥳', '🤔', '👍', '❤️', '🔥', '✨', '🎉', '👏', '🙌', '🤝', '👀', '🎮'].map(emoji => (
                      <button 
                        key={emoji} 
                        className="hero-emoji-item" 
                        onClick={() => handleEmojiClick(emoji)}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </>
        )}
      </div>
      
      {/* Voice Chat component */}
      <VoiceChat 
        socket={socket} 
        inRoom={inRoom} 
        roomId={roomId} 
        players={players}
        currentPlayerId={socket?.id}
      />
    </div>
  );
}

export default App; 