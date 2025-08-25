import React, { useState, useEffect, useRef, Children } from 'react';
import io from 'socket.io-client';
import { SOCKET_SERVER_URL, SOCKET_OPTIONS } from './socketConfig';
import './App.css';
import BackgroundManager from './BackgroundManager';
import './BackgroundManager.css';
import { defaultBackgroundSettings } from './BackgroundSettings';
import SpriteManager from './SpriteManager';
import CharacterSelector from './CharacterSelector';
import { getSpriteConfigById } from './SpriteConfigs';
import PlayerList from './PlayerList';
import VoiceChat from './VoiceChat';
import { checkVoiceChatCompatibility } from './browserUtils';
import Stepper, { Step } from './Stepper';
import AdminPanel from './AdminPanel';
import audioManager from './AudioManager';

// Available bubble colors for selection
const bubbleColors = [
  { name: 'Lavender', value: '#B7B1F2' },
  { name: 'Pink', value: '#FDB7EA' },
  { name: 'Peach', value: '#FFDCCC' },
  { name: 'Yellow', value: '#FBF3B9' },
];

// Define bubble border styles
const bubbleStyles = [
  { name: 'Dotted', value: 'dotted' },
  { name: 'Dashed', value: 'dashed' },
  { name: 'Solid', value: 'solid' },
  { name: 'Double', value: 'double' },
  { name: 'Groove', value: 'groove' },
  { name: 'Inset', value: 'inset' },
  { name: 'Outset', value: 'outset' },
  { name: 'None', value: 'none' },
];

// Movement speed for keyboard controls - increased for better movement
const MOVEMENT_SPEED = 5;

// Base distance for chat bubbles from player square
const BASE_BUBBLE_DISTANCE = 45;
// Additional distance per line of text (approx)
const DISTANCE_PER_LINE = 16;
// Max lines to consider for distance calculation
const MAX_LINES = 3;
const PROXIMITY_THRESHOLD = 150; // Distance threshold for proximity detection in pixels

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
  const [bubbleColor, setBubbleColor] = useState('#B7B1F2'); // Default bubble color
  const [bubbleStyle, setBubbleStyle] = useState('solid'); // Default border style
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
  const [chatMessages, setChatMessages] = useState([]);
  const [playersInVoiceChat, setPlayersInVoiceChat] = useState({}); // Track players in voice chat
  const [talkingPlayers, setTalkingPlayers] = useState({}); // Track players currently talking
  const [gameBackground, setGameBackground] = useState('default');
  const [nearbyPlayers, setNearbyPlayers] = useState([]); // Track players in proximity
  
  // PVP system state
  const [pvpStatuses, setPvpStatuses] = useState({}); // Track PVP status for all players
  const [myPvpStatus, setMyPvpStatus] = useState(false); // Track my own PVP status
  const [pvpTarget, setPvpTarget] = useState(null); // Track current PVP target
  const [isDead, setIsDead] = useState(false); // Track if player is dead
  const [showRevivalPopup, setShowRevivalPopup] = useState(false); // Show revival popup
  const [showProximityPrompt, setShowProximityPrompt] = useState(false); // Show interaction prompt
  const [showInteractionMenu, setShowInteractionMenu] = useState(false); // Show interaction menu
  const [selectedPlayer, setSelectedPlayer] = useState(null); // Selected player for interaction
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loginMode, setLoginMode] = useState('login'); // 'login', 'signup', or 'guest'
  const [registeredUsers, setRegisteredUsers] = useState([
    // Example registered users for demonstration
    { userId: 'user1', password: 'Password', email: 'user1@example.com' },
    { userId: 'user2', password: 'Password', email: 'user2@example.com' },
    { userId: 'takochn', password: 'Password', email: 'takochn@example.com' },
    { userId: '1', password: '1', email: 'user1@example.com' }
  ]);
  const [friendRequests, setFriendRequests] = useState([]); // Track friend requests
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 }); // Position for the radial menu
  const [menuFadeout, setMenuFadeout] = useState(false);
  const menuTimerRef = useRef(null);
  
  // Monster system state
  const [monsters, setMonsters] = useState([]); // Track monsters in the room
  const [playerStats, setPlayerStats] = useState({
    hp: 100,
    maxHp: 100,
    attack: 10,
    level: 1,
    exp: 0,
    expToNextLevel: 100
  }); // Track player combat stats
  const [showCombatUI, setShowCombatUI] = useState(false); // Show combat UI
  const [combatMessages, setCombatMessages] = useState([]); // Combat log messages
  const [lastAttackTime, setLastAttackTime] = useState(0); // Track attack cooldown
  
  // Sword system state
  const [swords, setSwords] = useState([]); // Track swords in the room
  const [playerInventory, setPlayerInventory] = useState({
    hasSword: false,
    swordType: null
  }); // Track player inventory
  
  // Gun system state
  const [guns, setGuns] = useState([]); // Track guns in the room
  const [playerGun, setPlayerGun] = useState({
    hasGun: false,
    gunType: null,
    ammo: 0,
    lastShot: 0
  }); // Track player gun inventory
  const [projectiles, setProjectiles] = useState([]); // Track active projectiles
  const [lastShotTime, setLastShotTime] = useState(0); // Track shooting cooldown
  
  // Admin panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Admin access control state
  const [showAdminAccess, setShowAdminAccess] = useState(true); // Start with admin access screen
  const [adminAccessGranted, setAdminAccessGranted] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAccessError, setAdminAccessError] = useState('');
  
  // Invite code state
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeError, setInviteCodeError] = useState('');
  
  // Invited users list (for beta testing)
  const [invitedUsers] = useState([
    { userId: 'takochn', password: 'Password', email: 'takochn@example.com', name: 'Tako' },
    { userId: 'admin', password: 'Password', email: 'admin@example.com', name: 'Admin' },
    { userId: 'beta1', password: 'Password', email: 'beta1@example.com', name: 'Beta Tester 1' },
    { userId: 'beta2', password: 'Password', email: 'beta2@example.com', name: 'Beta Tester 2' },
    { userId: 'guest', password: 'Password', email: 'guest@example.com', name: 'Guest User' },
    { userId: '1', password: '1', email: 'user1@example.com', name: 'User One' },
    { userId: '2', password: '2', email: 'user2@example.com', name: 'User Two' },
    { userId: '3', password: '3', email: 'user3@example.com', name: 'User Three' }
  ]);
  
  // Valid invite codes
  const VALID_INVITE_CODES = ['BETA2024', 'TCGV5', 'INVITE123', 'ACCESS2024'];
  
  // Admin credentials
  const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: '1'
  };
  
  const gameAreaRef = useRef(null); // Reference to the game area for positioning
  const timeoutsRef = useRef({}); // Store timeouts in a ref
  const textMeasurerRef = useRef(null); // Reference to measure text size
  
  // Attack animation state
  const [isAttacking, setIsAttacking] = useState(false); // Track if player is currently attacking
  const [attackAnimation, setAttackAnimation] = useState({}); // Track attack animations for all players
  const [swordSwingAngle, setSwordSwingAngle] = useState(0); // Track sword swing animation angle
  
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
  }, [inRoom, socket, isAttacking]);
  
  // Sword swing animation effect
  useEffect(() => {
    if (!isAttacking) return;
    
    const animationDuration = 300; // 300ms for full swing
    const startTime = Date.now();
    
    const animateSword = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Create a smooth swing motion (0 to 90 degrees)
      const angle = progress * 90;
      setSwordSwingAngle(angle);
      
      if (progress < 1) {
        requestAnimationFrame(animateSword);
      }
    };
    
    requestAnimationFrame(animateSword);
  }, [isAttacking]);
  
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
      // Add a 50px buffer on each side to account for the player sprite centering (100px width/height)
      x = Math.max(50, Math.min(rect.width - 50, x));
      y = Math.max(50, Math.min(rect.height - 50, y));
      
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
    const newSocket = io(SOCKET_SERVER_URL, SOCKET_OPTIONS);
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
          bubbleStyle: bubbleStyle, // Add bubble style to join data
          spriteId: spriteId,
          userId: userId // Include user ID for registered users
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

    // Add event listeners
    if (socket) {
      socket.on('chat-message', handleChatMessage);
      socket.on('player-joined', handlePlayerJoined);
      socket.on('player-left', handlePlayerLeft);
      socket.on('position-update', handlePositionUpdate);
      socket.on('game-background-update', handleBackgroundUpdate);
      socket.on('voice-chat-update', handleVoiceChatUpdate);
    }

    // Add a global function to allow direct update of playersInVoiceChat state
    window.updateVoiceChatPlayers = (playerUpdate) => {
      console.log("Direct update to voice chat players:", playerUpdate);
      setPlayersInVoiceChat(prev => ({
        ...prev,
        ...playerUpdate
      }));
    };

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.disconnect();
      
      // Clear all timeouts when socket disconnects
      Object.values(timeoutsRef.current).forEach(timeout => clearTimeout(timeout));
      
      if (socket) {
        socket.off('chat-message', handleChatMessage);
        socket.off('player-joined', handlePlayerJoined);
        socket.off('player-left', handlePlayerLeft);
        socket.off('position-update', handlePositionUpdate);
        socket.off('game-background-update', handleBackgroundUpdate);
        socket.off('voice-chat-update', handleVoiceChatUpdate);
      }
      delete window.updateVoiceChatPlayers;
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

  // Add this function to generate random guest names
  const generateGuestName = () => {
    const adjectives = ['Happy', 'Clever', 'Brave', 'Wise', 'Swift', 'Bright', 'Calm', 'Wild', 'Gentle', 'Bold'];
    const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Wolf', 'Bear', 'Fox', 'Owl', 'Dragon'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${randomAdjective}${randomNoun}`;
  };

  // Add a state for success messages
  const [successMessage, setSuccessMessage] = useState('');

  // Admin access functions
  const handleAdminAccess = () => {
    if (adminPassword === ADMIN_CREDENTIALS.password) {
      setAdminAccessGranted(true);
      setShowAdminAccess(false);
      setAdminAccessError('');
      setIsAdmin(true);
    } else {
      setAdminAccessError('Invalid admin password');
    }
  };

  const handleSkipAdminAccess = () => {
    setShowAdminAccess(false);
    setShowInviteCode(true);
    setAdminAccessGranted(false);
    setIsAdmin(false);
  };

  const checkIfUserIsInvited = (userId) => {
    return invitedUsers.some(user => user.userId === userId);
  };

  const getInvitedUserInfo = (userId) => {
    return invitedUsers.find(user => user.userId === userId);
  };

  const handleInviteCodeValidation = () => {
    if (!inviteCode.trim()) {
      setInviteCodeError('Please enter an invite code');
      return false;
    }
    
    if (!VALID_INVITE_CODES.includes(inviteCode.trim().toUpperCase())) {
      setInviteCodeError('Invalid invite code');
      return false;
    }
    
    // Valid invite code - proceed to login
    setShowInviteCode(false);
    setInviteCodeError('');
    setInviteCode('');
    return true;
  };

  // Add this function to the App component to validate login before proceeding
  const validateLogin = () => {
    // Clear any previous messages
    setError('');
    setSuccessMessage('');
    
    // For Step 1 (Login), validate credentials
    if (loginMode === 'login') {
      // Must have a user ID and password
      if (!userId || !password) {
        setError('User ID and Password are required');
        return false;
      }
      
      // Check if user is invited (for beta testing)
      if (!checkIfUserIsInvited(userId)) {
        setError('Access Denied: You are not on the beta testing list');
        return false;
      }
      
      // Check if user exists and password matches in invited users
      const user = getInvitedUserInfo(userId);
      if (!user) {
        setError('Oops! Wrong Login Details!');
        return false;
      }
      
      if (user.password !== password) {
        setError('Oops! Wrong Login Details!');
        return false;
      }
      
      // Valid login
      setSuccessMessage(`Welcome Back, ${user.userId}!`);
      return true;
    } 
    else if (loginMode === 'signup') {
      // Must have all fields
      if (!userId || !password || !email) {
        setError('All fields are required');
        return false;
      }
      
      // Check if user is invited (for beta testing)
      if (!checkIfUserIsInvited(userId)) {
        setError('Access Denied: You are not on the beta testing list');
        return false;
      }
      
      // For beta testing, users must already be in the invited list
      // Check if user already exists in invited users
      const userExists = getInvitedUserInfo(userId);
      if (userExists) {
        setError('User ID already exists');
        return false;
      }
      
      // In beta testing, we don't allow new signups - users must be pre-invited
      setError('Access Denied: You are not on the beta testing list');
      return false;
      setSuccessMessage('Welcome to Chat.io!');
      return true;
    } 
    else if (loginMode === 'guest') {
      // Generate a random guest name automatically
      const guestName = generateGuestName();
      setName(guestName);
      setUserId(guestName);
      setSuccessMessage(`Logging in as ${guestName}`);
      return true;
    }
    
    return false;
  };

  // Replace the handleAuthentication function with a fixed version
  const handleAuthentication = () => {
    return validateLogin();
  };

  // Update the useEffect for the next button with better step detection
  useEffect(() => {
    // Listen for the custom validation event from Stepper
    const handleStepValidation = (e) => {
      const { currentStep } = e.detail;
      console.log('Validating step transition from step:', currentStep);
      
      // If this is the first step (login step), validate credentials
      if (currentStep === 1) {
        console.log('Validating login credentials');
        if (!validateLogin()) {
          console.log('Login validation failed - preventing transition');
          e.preventDefault(); // Prevent the default (which is to proceed)
          return false;
        }
        console.log('Login validation succeeded');
      }
      
      // Allow transition for other steps
      return true;
    };
    
    // Add the event listener
    document.addEventListener('validateStepTransition', handleStepValidation);
    
    // Clean up
    return () => {
      document.removeEventListener('validateStepTransition', handleStepValidation);
    };
  }, [userId, password, email, loginMode, registeredUsers]);

  const handleJoinRoom = () => {
    // For guest mode, auto-set some values if they aren't already set
    if (loginMode === 'guest') {
      // If no name is set (though it should be from validateLogin), generate one
      if (!name) {
        setName(generateGuestName());
      }
      
      // Default role for guests if not selected
      if (!role) {
        setRole('roleA');
      }
      
      // Default room for guests
      if (!roomId) {
        setRoomId('guest-room');
      }
    }

    // Check requirements after auto-setting guest values
    if (!name || !role || !roomId) {
      setError('Please fill in all required fields');
      return;
    }

    if (socket) {
      // Create the data object with all user information
      const data = {
        name: name,
        roomId: roomId,
        role: role,
        bubbleColor: bubbleColor,
        bubbleStyle: bubbleStyle, // Add bubble style to join data
        spriteId: spriteId,
        userId: userId // Include user ID for registered users
      };
      
      console.log('Joining room with data:', data);
      socket.emit('joinRoom', data);
      
      // Set in room state to true
      setInRoom(true);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      // Calculate optimal bubble distance based on message content
      const bubbleDistance = calculateBubbleDistance(message.trim());
      
      // Send message with calculated distance and bubble style
      socket.emit('chat', {
        text: message.trim(),
        bubbleDistance,
        bubbleStyle
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
    
    // Stop background music when leaving room
    audioManager.stopBackgroundMusic();
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
      
      // Start background music when entering room
      audioManager.playBackgroundMusic();
      
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
      
      // Initialize monsters if available
      if (data.monsters) {
        console.log('Monsters in room:', data.monsters);
        setMonsters(data.monsters);
      }
      
      // Initialize swords if available
      if (data.swords) {
        console.log('Swords in room:', data.swords);
        setSwords(data.swords);
      }
      
      // Initialize guns if available
      if (data.guns) {
        console.log('=== GUNS INITIALIZATION DEBUG ===');
        console.log('Guns in room:', data.guns);
        console.log('Number of guns:', data.guns.length);
        console.log('Gun details:', data.guns.map(g => ({ id: g.id, name: g.name, position: g.position })));
        setGuns(data.guns);
        console.log('=== GUNS INITIALIZATION COMPLETE ===');
      } else {
        console.log('No guns received from server');
      }
      
      // Initialize player stats if available
      if (data.playerStats) {
        console.log('Player stats:', data.playerStats);
        setPlayerStats(data.playerStats);
      }
      
      // Initialize player inventory if available
      if (data.playerInventory) {
        console.log('Player inventory:', data.playerInventory);
        setPlayerInventory(data.playerInventory);
      }
      
      // Initialize player gun inventory if available
      if (data.playerGunInventory) {
        console.log('Player gun inventory:', data.playerGunInventory);
        setPlayerGun(data.playerGunInventory);
      }
      
      // Initialize PVP statuses if available
      if (data.pvpStatuses) {
        console.log('PVP statuses:', data.pvpStatuses);
        setPvpStatuses(data.pvpStatuses);
        setMyPvpStatus(data.pvpStatuses[socket.id] || false);
      }
      
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
      
      // Check if user is admin
      const adminUsers = ['admin', 'takochn'];
      const isUserAdmin = adminUsers.includes(userId);
      console.log('Admin check:', { userId, isUserAdmin, adminUsers });
      setIsAdmin(isUserAdmin);
      
      // Debug: Force admin status for testing
      if (userId === 'takochn' || userId === 'admin') {
        console.log('Forcing admin status for testing');
        setIsAdmin(true);
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
    
    // Monster system socket event handlers
    socket.on('monsterSpawned', (monster) => {
      console.log('Monster spawned:', monster);
      setMonsters(prev => [...prev, monster]);
      addCombatMessage(`A ${monster.name} has appeared!`, 'spawn');
    });
    
    socket.on('monsterMoved', (data) => {
      console.log('Monster moved:', data);
      
      // Update monster position
      setMonsters(prev => prev.map(monster => 
        monster.id === data.monsterId 
          ? { ...monster, position: data.position }
          : monster
      ));
      
      // Add moving animation class to the monster element
      const monsterElement = document.getElementById(`monster-${data.monsterId}`);
      if (monsterElement) {
        monsterElement.classList.add('moving');
        setTimeout(() => {
          monsterElement.classList.remove('moving');
        }, 800); // Remove class after animation completes
      }
    });
    
    socket.on('monsterDamaged', (data) => {
      console.log('Monster damaged:', data);
      setMonsters(prev => prev.map(monster => 
        monster.id === data.monsterId 
          ? { ...monster, hp: data.health || data.remainingHp }
          : monster
      ));
      
      // Handle different data formats from different damage sources
      const damageAmount = data.damage;
      const attackerName = data.attackerName || 'You';
      addCombatMessage(`${attackerName} deals ${damageAmount} damage to the monster!`, 'attack');
    });
    
    socket.on('monsterKilled', (data) => {
      console.log('Monster killed:', data);
      setMonsters(prev => prev.filter(monster => monster.id !== data.monsterId));
      addCombatMessage(`${data.killerName} defeated the ${data.monsterName}! +${data.expGained} EXP`, 'kill');
      
      // Play monster death sound
      audioManager.playMonsterDeath();
      
      // Update player stats if it's our kill
      if (data.killerId === socket.id) {
        setPlayerStats(data.playerStats);
      }
    });
    
    socket.on('playerDamaged', (data) => {
      console.log('Player damaged:', data);
      if (data.playerId === socket.id) {
        setPlayerStats(prev => ({ ...prev, hp: data.remainingHp }));
        addCombatMessage(`You took ${data.damage} damage from ${data.monsterName}!`, 'damage');
      }
    });
    
    socket.on('playerDied', (data) => {
      console.log('Player died:', data);
      if (data.playerId === socket.id) {
        setPlayerStats(data.playerStats);
        addCombatMessage('You died and respawned!', 'death');
        
        // Update player position
        setPlayerPositions(prev => ({
          ...prev,
          [socket.id]: data.respawnPosition
        }));
      }
    });
    
    // Sword system socket event handlers
    socket.on('swordSpawned', (sword) => {
      console.log('Sword spawned:', sword);
      setSwords(prev => [...prev, sword]);
      addCombatMessage(`A ${sword.name} has appeared!`, 'spawn');
    });
    
    socket.on('swordPickedUp', (data) => {
      console.log('Sword picked up:', data);
      setSwords(prev => prev.filter(sword => sword.id !== data.swordId));
      addCombatMessage(`${data.playerName} picked up ${data.swordName}!`, 'pickup');
    });
    
    socket.on('inventoryUpdated', (inventory) => {
      console.log('Inventory updated:', inventory);
      setPlayerInventory(inventory);
      if (inventory.hasSword) {
        addCombatMessage(`You equipped a sword!`, 'equip');
      }
    });
    
    // Gun system socket event handlers
    socket.on('gunSpawned', (gun) => {
      console.log('=== GUN SPAWNED DEBUG ===');
      console.log('Gun spawned:', gun);
      console.log('Current guns before adding:', guns);
      console.log('Socket connected:', !!socket);
      console.log('In room:', inRoom);
      setGuns(prev => {
        console.log('Previous guns state:', prev);
        const newGuns = [...prev, gun];
        console.log('New guns state:', newGuns);
        return newGuns;
      });
      addCombatMessage(`A ${gun.name} has appeared!`, 'spawn');
      console.log('=== GUN SPAWNED COMPLETE ===');
    });
    
    socket.on('gunPickedUp', (data) => {
      console.log('=== GUN PICKED UP DEBUG ===');
      console.log('Gun picked up data:', data);
      console.log('Current guns before removal:', guns);
      
      setGuns(prev => {
        const newGuns = prev.filter(g => g.id !== data.gunId);
        console.log('Guns after removal:', newGuns);
        return newGuns;
      });
      
      // The server sends gunName, not gun.name
      addCombatMessage(`Picked up ${data.gunName}!`, 'pickup');
      console.log('=== GUN PICKED UP COMPLETE ===');
    });
    
    socket.on('gunUpdated', (gun) => {
      console.log('=== GUN UPDATED DEBUG ===');
      console.log('Gun updated:', gun);
      setPlayerGun(gun);
      console.log('=== GUN UPDATED COMPLETE ===');
    });
    
    socket.on('gunInventoryUpdated', (gunInventory) => {
      console.log('=== GUN INVENTORY UPDATED DEBUG ===');
      console.log('Gun inventory updated:', gunInventory);
      setPlayerGun(gunInventory);
      console.log('=== GUN INVENTORY UPDATED COMPLETE ===');
    });
    
    socket.on('gunShootFailed', (data) => {
      console.log('=== GUN SHOOT FAILED DEBUG ===');
      console.log('Gun shoot failed:', data);
      addCombatMessage(`Cannot shoot: ${data.reason}`, 'warning');
      console.log('=== GUN SHOOT FAILED COMPLETE ===');
    });
    
    socket.on('projectileCreated', (projectile) => {
      console.log('=== PROJECTILE CREATED DEBUG ===');
      console.log('Projectile created:', projectile);
      setProjectiles(prev => [...prev, projectile]);
      console.log('=== PROJECTILE CREATED COMPLETE ===');
    });
    
    socket.on('projectilesUpdated', (updatedProjectiles) => {
      console.log('=== PROJECTILES UPDATED DEBUG ===');
      console.log('Projectiles updated:', updatedProjectiles);
      setProjectiles(updatedProjectiles);
      console.log('=== PROJECTILES UPDATED COMPLETE ===');
    });
    

    
    socket.on('gunShot', (data) => {
      console.log('Gun shot:', data);
      addCombatMessage(`${data.playerName} fired their ${data.gunType}!`, 'attack');
      
      // Play gun shot sound for other players' shots
      if (data.playerId !== socket.id) {
        if (data.gunType === 'pistol') {
          audioManager.playPistolShot();
        } else if (data.gunType === 'shotgun') {
          audioManager.playShotgunShot();
        } else if (data.gunType === 'machine_gun') {
          audioManager.playSMGShot();
        }
      }
    });
    
    socket.on('projectileHit', (data) => {
      console.log('Projectile hit:', data);
      addCombatMessage(`Projectile hit for ${data.damage} damage!`, 'attack');
    });
    
    socket.on('shootError', (message) => {
      console.log('=== SHOOT ERROR ===');
      console.log('Shoot error message:', message);
      addCombatMessage(message, 'warning');
    });
    
    socket.on('gunShootFailed', (data) => {
      console.log('=== GUN SHOOT FAILED ===');
      console.log('Gun shoot failed data:', data);
      addCombatMessage(`Gun shoot failed: ${data.reason}`, 'warning');
    });
    
    // PVP System Event Handlers
    
    socket.on('pvpStatusChanged', (data) => {
      console.log('PVP status changed:', data);
      setPvpStatuses(prev => ({
        ...prev,
        [data.playerId]: data.isPVP
      }));
      
      if (data.playerId === socket.id) {
        setMyPvpStatus(data.isPVP);
      }
      
      addCombatMessage(`${data.playerName} ${data.isPVP ? 'enabled' : 'disabled'} PVP mode!`, 'pvp');
    });
    
    socket.on('pvpStatusUpdated', (data) => {
      console.log('My PVP status updated:', data);
      setMyPvpStatus(data.isPVP);
      addCombatMessage(data.message, 'pvp');
    });
    
    socket.on('pvpAttack', (data) => {
      console.log('PVP attack:', data);
      addCombatMessage(`${data.attackerName} attacked ${data.targetName} for ${data.damage} damage!`, 'pvp');
      
      // Update HP for the target player (works for both self and others)
      setPlayerStats(prev => {
        const newStats = { ...prev };
        if (data.targetId === socket.id) {
          // If we are the target, update our HP
          const newHP = Math.max(0, (newStats.hp || 100) - data.damage);
          newStats.hp = newHP;
          
          // Check if we died
          if (newHP <= 0) {
            console.log('=== PLAYER DIED ===');
            console.log('Setting isDead to true');
            console.log('Setting showRevivalPopup to true');
            setIsDead(true);
            setShowRevivalPopup(true);
            addCombatMessage('You have been killed! Click to revive.', 'death');
          }
        } else {
          // If someone else is the target, update their HP in our local state
          // This ensures HP bars update for all players
          const targetPlayerStats = newStats[data.targetId] || { hp: 100, maxHp: 100 };
          const newHP = Math.max(0, targetPlayerStats.hp - data.damage);
          newStats[data.targetId] = {
            ...targetPlayerStats,
            hp: newHP
          };
        }
        return newStats;
      });
      
      // Play appropriate sound effect
      if (data.weaponType === 'sword') {
        audioManager.playSwordSwing();
      } else if (data.weaponType === 'gun') {
        audioManager.playPistolShot();
      }
    });
    
    socket.on('pvpKill', (data) => {
      console.log('PVP kill:', data);
      addCombatMessage(`${data.killerName} killed ${data.victimName}!`, 'pvp');
      
      // Update victim's position if it's us
      if (data.victimId === socket.id) {
        setPlayerPositions(prev => ({
          ...prev,
          [socket.id]: data.respawnPosition
        }));
      }
    });
    
    socket.on('playerStatsUpdated', (stats) => {
      console.log('Player stats updated:', stats);
      setPlayerStats(stats);
    });

    socket.on('playerRevived', (data) => {
      console.log('Player revived:', data);
      
      // If it's us, update our position and stats
      if (data.playerId === socket.id) {
        setPlayerPositions(prev => ({
          ...prev,
          [socket.id]: data.newPosition
        }));
        
        setPlayerStats(prev => ({
          ...prev,
          hp: data.newHp
        }));
        
        setIsDead(false);
        setShowRevivalPopup(false);
      }
      
      addCombatMessage(`${data.playerName} has been revived!`, 'revival');
    });
    
    return () => {
      socket.off('roomJoined', handleRoomJoined);
      socket.off('initialPositions', handleInitialPositions);
      socket.off('backgroundChanged');
      socket.off('monsterSpawned');
      socket.off('monsterMoved');
      socket.off('monsterDamaged');
      socket.off('monsterKilled');
      socket.off('playerDamaged');
      socket.off('playerDied');
      socket.off('gunPickedUp');
      socket.off('gunUpdated');
      socket.off('gunInventoryUpdated');
      socket.off('gunShootFailed');
      socket.off('projectileCreated');
      socket.off('projectilesUpdated');
      socket.off('gunShot');
      socket.off('projectileHit');
      socket.off('shootError');
      socket.off('pvpStatusChanged');
      socket.off('pvpStatusUpdated');
      socket.off('pvpAttack');
      socket.off('pvpKill');
      socket.off('playerStatsUpdated');
      socket.off('playerRevived');
    };
  }, [socket]);

  // Handle voice chat updates properly
  const handleVoiceChatUpdate = (data) => {
    console.log("Received voice-chat-update with data:", data);
    
    if (data.talkingPlayers) {
      console.log("Updating talking players:", data.talkingPlayers);
      setTalkingPlayers(data.talkingPlayers);
    }
    
    if (data.playersInVoiceChat) {
      console.log("Updating players in voice chat:", data.playersInVoiceChat);
      console.log("Current playersInVoiceChat state:", playersInVoiceChat);
      
      // Get all players that are in voice chat according to server data
      const voiceChatPlayerIds = Object.keys(data.playersInVoiceChat).filter(id => 
        data.playersInVoiceChat[id] === true
      );
      
      // Check if we already know about these players
      const knownIds = Object.keys(playersInVoiceChat).filter(id => playersInVoiceChat[id]);
      const same = voiceChatPlayerIds.length === knownIds.length && 
        voiceChatPlayerIds.every(id => knownIds.includes(id));
      
      // Log who is in voice chat according to server
      console.log("Players in voice chat according to server:", 
        voiceChatPlayerIds.map(id => {
          const player = players.find(p => p.id === id);
          return player ? `${player.name} (${id})` : id;
        }).join(', ') || 'none'
      );
      
      if (!same) {
        console.log("Voice chat state has changed, updating state");
        // Always update with the server's state to ensure consistency
        setPlayersInVoiceChat(data.playersInVoiceChat);
      } else {
        console.log("Voice chat state is the same, no update needed");
      }
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

  // Monster system helper functions
  const addCombatMessage = (message, type = 'info') => {
    const newMessage = {
      id: Date.now(),
      text: message,
      type: type,
      timestamp: Date.now()
    };
    setCombatMessages(prev => [...prev.slice(-9), newMessage]); // Keep last 10 messages
  };

  const attackMonster = (monsterId) => {
    if (!socket || !inRoom) return;
    
    // Check attack cooldown (1 second)
    const now = Date.now();
    if (now - lastAttackTime < 1000) {
      addCombatMessage('Attack on cooldown!', 'warning');
      return;
    }
    
    setLastAttackTime(now);
    socket.emit('attackMonster', { monsterId });
  };
  
  const pickupSword = (swordId) => {
    console.log(`=== CLIENT SWORD PICKUP DEBUG ===`);
    console.log(`Attempting to pick up sword: ${swordId}`);
    console.log(`Socket connected: ${!!socket}`);
    console.log(`In room: ${inRoom}`);
    console.log(`Current swords array:`, swords);
    console.log(`Current player position:`, playerPositions[socket?.id]);
    console.log(`Socket ID: ${socket?.id}`);
    
    if (!socket || !inRoom) {
      console.log(`Cannot pick up sword - socket: ${!!socket}, inRoom: ${inRoom}`);
      addCombatMessage('Cannot pick up sword - not connected!', 'warning');
      return;
    }
    
    // Find the sword in the current swords array
    const sword = swords.find(s => s.id === swordId);
    if (sword) {
      console.log(`Found sword: ${sword.name} (${sword.damage} ATK) at position:`, sword.position);
      
      // Calculate distance to sword
      const myPosition = playerPositions[socket.id];
      if (myPosition) {
        const distance = calculateDistance(myPosition, sword.position);
        console.log(`Distance to sword: ${distance}px (max: 60px)`);
        
        if (distance > 60) {
          console.log(`Too far from sword! Distance: ${distance}px`);
          addCombatMessage(`Too far from sword! (${Math.round(distance)}px away)`, 'warning');
          return;
        }
      } else {
        console.log(`No player position found for socket ${socket.id}`);
        addCombatMessage('Cannot determine position!', 'warning');
        return;
      }
      
      addCombatMessage(`Attempting to pick up ${sword.name}...`, 'info');
    } else {
      console.log(`Sword ${swordId} not found in swords array`);
      console.log(`Available swords:`, swords.map(s => ({ id: s.id, name: s.name })));
      addCombatMessage(`Sword not found!`, 'warning');
      return;
    }
    
    console.log(`Emitting pickupSword event with swordId: ${swordId}`);
    console.log(`Event data:`, { swordId });
    socket.emit('pickupSword', { swordId });
    console.log(`=== CLIENT SWORD PICKUP COMPLETE ===`);
  };

  // Gun system functions
  const pickupGun = (gunId) => {
    console.log(`=== CLIENT GUN PICKUP DEBUG ===`);
    console.log(`Attempting to pick up gun: ${gunId}`);
    console.log(`Socket connected: ${!!socket}`);
    console.log(`In room: ${inRoom}`);
    console.log(`Current guns array:`, guns);
    console.log(`Current player position:`, playerPositions[socket?.id]);
    console.log(`Socket ID: ${socket?.id}`);
    
    if (!socket || !inRoom) {
      console.log(`Cannot pick up gun - socket: ${!!socket}, inRoom: ${inRoom}`);
      addCombatMessage('Cannot pick up gun - not connected!', 'warning');
      return;
    }
    
    // Find the gun in the current guns array
    const gun = guns.find(g => g.id === gunId);
    if (gun) {
      console.log(`Found gun: ${gun.name} (${gun.damage} DMG, ${gun.ammo} ammo) at position:`, gun.position);
      
      // Calculate distance to gun
      const myPosition = playerPositions[socket.id];
      if (myPosition) {
        const distance = calculateDistance(myPosition, gun.position);
        console.log(`Distance to gun: ${distance}px (max: 60px)`);
        
        if (distance > 60) {
          console.log(`Too far from gun! Distance: ${distance}px`);
          addCombatMessage(`Too far from gun! (${Math.round(distance)}px away)`, 'warning');
          return;
        }
      } else {
        console.log(`No player position found for socket ${socket.id}`);
        addCombatMessage('Cannot determine position!', 'warning');
        return;
      }
      
      addCombatMessage(`Attempting to pick up ${gun.name}...`, 'info');
    } else {
      console.log(`Gun ${gunId} not found in guns array`);
      console.log(`Available guns:`, guns.map(g => ({ id: g.id, name: g.name })));
      addCombatMessage(`Gun not found!`, 'warning');
      return;
    }
    
    console.log(`Emitting pickupGun event with gunId: ${gunId}`);
    console.log(`Event data:`, { gunId });
    socket.emit('pickupGun', { gunId });
    console.log(`=== CLIENT GUN PICKUP COMPLETE ===`);
  };

  const shootGun = () => {
    console.log('=== GUN SHOOT DEBUG ===');
    console.log('Socket connected:', !!socket);
    console.log('In room:', inRoom);
    console.log('Current gun:', playerGun);
    
    if (!socket || !inRoom) {
      console.log('Cannot shoot - not connected or not in room');
      addCombatMessage('Cannot shoot - not connected!', 'warning');
      return;
    }
    
    if (!playerGun || !playerGun.hasGun) {
      console.log('No gun equipped');
      addCombatMessage('No gun equipped!', 'warning');
      return;
    }
    
    if (playerGun.ammo <= 0) {
      console.log('No ammo');
      addCombatMessage('Out of ammo!', 'warning');
      return;
    }
    
    // Check if player has a position
    const myPosition = playerPositions[socket.id];
    if (!myPosition) {
      console.log('No player position found');
      addCombatMessage('Cannot determine position!', 'warning');
      return;
    }
    
    console.log('Shooting gun:', playerGun.gunType, 'from position:', myPosition);
    
    try {
      // Send shoot request to server with current direction
      const currentDirection = playerDirections[socket.id] || 'down';
      socket.emit('shootGun', { direction: currentDirection });
      
      // Play gun shot sound based on gun type
      if (playerGun.gunType === 'pistol') {
        audioManager.playPistolShot();
      } else if (playerGun.gunType === 'shotgun') {
        audioManager.playShotgunShot();
      } else if (playerGun.gunType === 'machine_gun') {
        audioManager.playSMGShot();
      }
      
      addCombatMessage(`Shot ${playerGun.gunType}!`, 'attack');
      console.log('=== GUN SHOOT COMPLETE ===');
    } catch (error) {
      console.error('Error shooting gun:', error);
      addCombatMessage('Error shooting gun!', 'warning');
    }
  };



  const stopMachineGunFiring = () => {
    if (socket && playerGun && playerGun.gunType === 'machine_gun') {
      socket.emit('stopMachineGunFiring');
      addCombatMessage('Stopped machine gun firing!', 'info');
    }
  };
  
  // PVP System Functions
  
  const togglePVP = () => {
    console.log('=== PVP TOGGLE FUNCTION CALLED ===');
    console.log('togglePVP called', { socket: !!socket, inRoom, myPvpStatus });
    console.log('Current PVP statuses:', pvpStatuses);
    
    // Add error handling
    try {
      if (!socket || !inRoom) {
        addCombatMessage('Cannot toggle PVP - not in a room!', 'warning');
        return;
      }
      
      console.log('Emitting togglePVP event');
      socket.emit('togglePVP');
      console.log('Toggling PVP mode');
    } catch (error) {
      console.error('Error in togglePVP:', error);
    }
  };
  
  // Universal sword swing that hits everything in range
  const performSwordSwing = () => {
    console.log('=== SWORD SWING FUNCTION CALLED ===');
    if (!socket || !inRoom || isAttacking) {
      console.log('Sword swing blocked:', { socket: !!socket, inRoom, isAttacking });
      return;
    }
    
    const myPosition = playerPositions[socket.id];
    if (!myPosition) return;
    
    console.log('=== SWORD SWING DEBUG ===');
    console.log('My PVP status:', myPvpStatus);
    console.log('All PVP statuses:', pvpStatuses);
    console.log('Players in room:', players.length);
    console.log('My position:', myPosition);
    
    // Start attack animation
    setIsAttacking(true);
    setSwordSwingAngle(0);
    
    // Play sword swing sound
    audioManager.playSwordSwing();
    
    // Find all targets in sword range (200 pixels for PVP, 80 for monsters)
    const targets = [];
    
    // Check monsters in range
    monsters.forEach(monster => {
      // Calculate distance from my center to monster center
      // Player sprites are 80x80 pixels, so center is at position + 40
      const myCenter = {
        x: myPosition.x + 40,
        y: myPosition.y + 40
      };
      const monsterCenter = {
        x: monster.position.x + 40, // Assuming monsters are also 80x80
        y: monster.position.y + 40
      };
      
      const distance = calculateDistance(myCenter, monsterCenter);
      if (distance <= 80) {
        targets.push({ type: 'monster', id: monster.id, distance });
      }
    });
    
    // Check PVP players in range (if PVP mode is on)
    if (myPvpStatus) {
      console.log('Checking PVP players...');
      players.forEach(player => {
        if (player.id !== socket.id && pvpStatuses[player.id]) {
          const theirPosition = playerPositions[player.id] || { x: 0, y: 0 };
          
          // Calculate distance from my center to their center
          // Player sprites are 80x80 pixels, so center is at position + 40
          const myCenter = {
            x: myPosition.x + 40,
            y: myPosition.y + 40
          };
          const theirCenter = {
            x: theirPosition.x + 40,
            y: theirPosition.y + 40
          };
          
          const distance = calculateDistance(myCenter, theirCenter);
          console.log(`Player ${player.name} (${player.id}): PVP=${pvpStatuses[player.id]}, distance=${distance}, myCenter=${JSON.stringify(myCenter)}, theirCenter=${JSON.stringify(theirCenter)}`);
          if (distance <= 200) {
            targets.push({ type: 'player', id: player.id, distance });
            console.log(`Added PVP player ${player.name} to targets`);
          }
        }
      });
    } else {
      console.log('PVP mode is OFF - not checking for PVP players');
    }
    
    console.log('Sword swing targets:', targets);
    
    // Attack all targets
    targets.forEach(target => {
      if (target.type === 'monster') {
        console.log(`Attacking monster ${target.id}`);
        attackMonster(target.id);
      } else if (target.type === 'player') {
        console.log(`Attacking PVP player ${target.id}`);
        console.log('Emitting pvpSwordAttack event with targetId:', target.id);
        socket.emit('pvpSwordAttack', { targetId: target.id });
        addCombatMessage(`Sword hit player!`, 'pvp');
      }
    });
    
    if (targets.length === 0) {
      addCombatMessage('Sword swing - nothing in range!', 'info');
    } else {
      addCombatMessage(`Sword swing hit ${targets.length} target(s)!`, 'attack');
    }
    
    // End attack animation after swing completes
    setTimeout(() => {
      setIsAttacking(false);
      setSwordSwingAngle(0);
    }, 300);
  };
  
  // Revival function
  const handleRevival = () => {
    console.log('=== REVIVAL ATTEMPT ===');
    console.log('Socket:', !!socket);
    console.log('In room:', inRoom);
    console.log('Is dead:', isDead);
    console.log('Show revival popup:', showRevivalPopup);
    
    if (!socket || !inRoom) {
      console.log('Cannot revive: missing socket or not in room');
      return;
    }
    
    console.log('Emitting playerRevived event to server...');
    
    // Emit revival event to server
    socket.emit('playerRevived');
    
    // Reset death state immediately for better UX
    setIsDead(false);
    setShowRevivalPopup(false);
    
    addCombatMessage('Revival request sent!', 'revival');
  };

  // Universal gun shot that hits everything in range
  const performGunShot = () => {
    if (!socket || !inRoom) return;
    
    const myPosition = playerPositions[socket.id];
    if (!myPosition) return;
    
    console.log('=== GUN SHOT DEBUG ===');
    console.log('My PVP status:', myPvpStatus);
    console.log('All PVP statuses:', pvpStatuses);
    console.log('Players in room:', players.length);
    console.log('My position:', myPosition);
    
    // Find all targets in gun range (300 pixels for PVP, 180 for monsters)
    const targets = [];
    
    // Check monsters in range
    monsters.forEach(monster => {
      // Calculate distance from my center to monster center
      // Player sprites are 80x80 pixels, so center is at position + 40
      const myCenter = {
        x: myPosition.x + 40,
        y: myPosition.y + 40
      };
      const monsterCenter = {
        x: monster.position.x + 40, // Assuming monsters are also 80x80
        y: monster.position.y + 40
      };
      
      const distance = calculateDistance(myCenter, monsterCenter);
      if (distance <= 180) {
        targets.push({ type: 'monster', id: monster.id, distance });
      }
    });
    
    // Check PVP players in range (if PVP mode is on)
    if (myPvpStatus) {
      console.log('Checking PVP players for gun shot...');
      players.forEach(player => {
        if (player.id !== socket.id && pvpStatuses[player.id]) {
          const theirPosition = playerPositions[player.id] || { x: 0, y: 0 };
          
          // Calculate distance from my center to their center
          // Player sprites are 80x80 pixels, so center is at position + 40
          const myCenter = {
            x: myPosition.x + 40,
            y: myPosition.y + 40
          };
          const theirCenter = {
            x: theirPosition.x + 40,
            y: theirPosition.y + 40
          };
          
          const distance = calculateDistance(myCenter, theirCenter);
          console.log(`Player ${player.name} (${player.id}): PVP=${pvpStatuses[player.id]}, distance=${distance}, myCenter=${JSON.stringify(myCenter)}, theirCenter=${JSON.stringify(theirCenter)}`);
          if (distance <= 300) {
            targets.push({ type: 'player', id: player.id, distance });
            console.log(`Added PVP player ${player.name} to gun targets`);
          }
        }
      });
    } else {
      console.log('PVP mode is OFF - not checking for PVP players');
    }
    
    console.log('Gun shot targets:', targets);
    
    // Attack all targets
    console.log('=== ATTACKING TARGETS ===');
    console.log('Number of targets found:', targets.length);
    
    targets.forEach(target => {
      if (target.type === 'monster') {
        console.log(`Shooting monster ${target.id} at distance ${target.distance}`);
        // Use existing gun shooting mechanism for monsters
        const currentDirection = playerDirections[socket.id] || 'down';
        console.log('Emitting shootGun with direction:', currentDirection);
        socket.emit('shootGun', { 
          gunType: playerGun.gunType,
          direction: currentDirection
        });
      } else if (target.type === 'player') {
        console.log(`Shooting PVP player ${target.id} at distance ${target.distance}`);
        console.log('Emitting pvpGunAttack event with targetId:', target.id);
        socket.emit('pvpGunAttack', { targetId: target.id });
        addCombatMessage(`Gun shot hit player!`, 'pvp');
      }
    });
    
    if (targets.length === 0) {
      addCombatMessage('Gun shot - nothing in range!', 'info');
    } else {
      addCombatMessage(`Gun shot hit ${targets.length} target(s)!`, 'attack');
    }
    
    // Play appropriate gun sound
    if (playerGun.gunType === 'pistol') {
      audioManager.playPistolShot();
    } else if (playerGun.gunType === 'shotgun') {
      audioManager.playShotgunShot();
    } else if (playerGun.gunType === 'machine_gun') {
      audioManager.playSMGShot();
    }
  };



  const isInAttackRange = (playerPos, monsterPos, range = 60) => {
    return calculateDistance(playerPos, monsterPos) <= range;
  };

  // Calculate distance between two points
  const calculateDistance = (pos1, pos2) => {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2)
    );
  };

  // Check for players in proximity
  useEffect(() => {
    if (!inRoom || !socket || !playerPositions[socket.id]) return;
    
    const myPosition = playerPositions[socket.id];
    const nearby = [];
    
    // Check all players
    players.forEach(player => {
      // Skip my own player
      if (player.id === socket.id) return;
      
      // Get other player's position
      const theirPosition = playerPositions[player.id];
      if (!theirPosition) return;
      
      // Calculate distance
      const distance = calculateDistance(myPosition, theirPosition);
      
      // Check if within proximity threshold
      if (distance <= PROXIMITY_THRESHOLD) {
        nearby.push({
          id: player.id,
          name: player.name,
          distance: distance,
          position: theirPosition
        });
      }
    });
    
    // Update nearby players
    setNearbyPlayers(nearby);
    
    // Show proximity prompt if there are nearby players
    setShowProximityPrompt(nearby.length > 0);
    
    // If no nearby players, close the interaction menu
    if (nearby.length === 0) {
      setShowInteractionMenu(false);
      setSelectedPlayer(null);
    }
  }, [playerPositions, players, inRoom, socket]);

  // Function to handle key presses for interaction
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ') {
        // Handle Spacebar for SWORD attacks only
        e.preventDefault();
        console.log('=== SPACEBAR PRESSED ===');
        console.log('playerInventory.hasSword:', playerInventory.hasSword);
        console.log('playerInventory:', playerInventory);
        
        if (playerInventory.hasSword) {
          console.log('Calling performSwordSwing...');
          performSwordSwing(); // Universal sword swing that hits everything in range
        } else {
          console.log('No sword equipped - showing warning');
          addCombatMessage('No sword equipped!', 'warning');
        }
      }
      
      if (e.key === 'c' || e.key === 'C') {
        // Handle C key for GUN attacks only
        e.preventDefault();
        console.log('=== C KEY PRESSED ===');
        console.log('playerGun:', playerGun);
        console.log('playerGun.hasGun:', playerGun?.hasGun);
        console.log('playerGun.ammo:', playerGun?.ammo);
        
        if (playerGun && playerGun.hasGun && playerGun.ammo > 0) {
          if (playerGun.gunType === 'machine_gun') {
            // Start continuous firing for machine gun
            console.log('Starting machine gun firing...');
            socket.emit('startMachineGunFiring');
            audioManager.playSMGShot();
            addCombatMessage('Started machine gun firing!', 'attack');
          } else {
            console.log('Calling performGunShot...');
            performGunShot(); // Universal gun shot that hits everything in range
          }
        } else {
          console.log('No gun equipped or out of ammo - showing warning');
          addCombatMessage('No gun equipped or out of ammo!', 'warning');
        }
      }
      
      if (e.key === 'f' || e.key === 'F') {
        // F key is ONLY for pickup and interaction, NOT for attacks
        const myPosition = playerPositions[socket?.id];
        
        // Check for swords to pickup
        if (myPosition && swords.length > 0) {
          let closestSword = null;
          let closestDistance = Infinity;
          
          swords.forEach(sword => {
            const distance = calculateDistance(myPosition, sword.position);
            if (distance <= 60 && distance < closestDistance) {
              closestDistance = distance;
              closestSword = sword;
            }
          });
          
          // If sword in range, pickup
          if (closestSword) {
            e.preventDefault();
            pickupSword(closestSword.id);
            return;
          }
        }
        
        // Check for guns to pickup
        if (myPosition && guns.length > 0) {
          let closestGun = null;
          let closestDistance = Infinity;
          
          guns.forEach(gun => {
            const distance = calculateDistance(myPosition, gun.position);
            if (distance <= 60 && distance < closestDistance) {
              closestDistance = distance;
              closestGun = gun;
            }
          });
          
          // If gun in range, pickup
          if (closestGun) {
            e.preventDefault();
            pickupGun(closestGun.id);
            return;
          }
        }
        
        // Handle player interaction
        if (showProximityPrompt && nearbyPlayers.length > 0) {
          // Select the closest player
          const closestPlayer = [...nearbyPlayers].sort((a, b) => a.distance - b.distance)[0];
          
          // If there's already a menu open for a different player, close it first
          if (selectedPlayer && selectedPlayer.id !== closestPlayer.id) {
            setMenuFadeout(true);
            setTimeout(() => {
              setShowInteractionMenu(false);
              setSelectedPlayer(null);
              setMenuFadeout(false);
              
              // Select the new player and show the menu
              setSelectedPlayer(closestPlayer);
              setShowInteractionMenu(true);
              startMenuTimer();
            }, 300); // Allow time for fadeout animation
          } else {
            // If menu is already showing, just reset the timer
            if (showInteractionMenu) {
              startMenuTimer();
            } else {
              // Otherwise show the menu for the first time
              setSelectedPlayer(closestPlayer);
              setShowInteractionMenu(true);
              startMenuTimer();
            }
          }
        }
      }
      
      if (e.key === 'Escape') {
        // Close interaction menu when Escape is pressed
        closeMenu();
      }
    };
    
    const handleKeyUp = (e) => {
      // Handle machine gun firing stop (now with C key)
      if ((e.key === 'c' || e.key === 'C') && playerGun && playerGun.gunType === 'machine_gun') {
        stopMachineGunFiring();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearMenuTimer();
    };
  }, [showProximityPrompt, nearbyPlayers, playerPositions, socket, showInteractionMenu, selectedPlayer, monsters, isAttacking, swords, guns, playerInventory]);

  // Start a timer that will close the menu after 10 seconds
  const startMenuTimer = () => {
    // Clear any existing timer
    clearMenuTimer();
    
    // Set a new timer
    menuTimerRef.current = setTimeout(() => {
      closeMenu();
    }, 10000); // 10 seconds
  };

  // Clear the menu timer
  const clearMenuTimer = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
  };

  // Close the menu with fadeout effect
  const closeMenu = () => {
    if (showInteractionMenu) {
      setMenuFadeout(true);
      setTimeout(() => {
        setShowInteractionMenu(false);
        setSelectedPlayer(null);
        setMenuFadeout(false);
      }, 500); // Match the animation duration from CSS
    }
  };

  // Continuous menu position update and proximity check
  useEffect(() => {
    if (!showInteractionMenu || !selectedPlayer || !socket) return;
    
    let animationFrameId;
    let lastFrameTime = performance.now();
    
    const updateMenuPosition = (currentTime) => {
      // Calculate delta time for frame independence
      const deltaTime = (currentTime - lastFrameTime) / 1000; // in seconds
      lastFrameTime = currentTime;
      
      // Get current positions of both players
      const myPosition = playerPositions[socket.id];
      const targetPosition = playerPositions[selectedPlayer.id];
      
      if (!myPosition || !targetPosition) {
        animationFrameId = requestAnimationFrame(updateMenuPosition);
        return;
      }
      
      // Check if players are still in proximity
      const distance = calculateDistance(myPosition, targetPosition);
      if (distance > PROXIMITY_THRESHOLD) {
        // Close menu if players are too far apart
        closeMenu();
        return;
      }
      
      // No need to update menu position as it's attached to the player DOM element now
      
      // Request next animation frame
      animationFrameId = requestAnimationFrame(updateMenuPosition);
    };
    
    // Start the animation loop
    animationFrameId = requestAnimationFrame(updateMenuPosition);
    
    // Clean up
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showInteractionMenu, selectedPlayer, socket, playerPositions]);

  const handleInteraction = (action, event) => {
    if (!selectedPlayer) return;
    
    // Prevent event propagation to avoid triggering player movement
    // when clicking on menu options
    if (event) {
      event.stopPropagation();
    }
    
    clearMenuTimer(); // Clear the timer when an action is taken
    
    switch (action) {
      case 'addFriend':
        console.log(`Adding ${selectedPlayer.name} as friend`);
        socket.emit('friendRequest', { 
          targetId: selectedPlayer.id,
          playerId: socket.id
        });
        break;
      case 'viewProfile':
        console.log(`Viewing ${selectedPlayer.name}'s profile`);
        socket.emit('requestProfile', { 
          targetId: selectedPlayer.id,
          playerId: socket.id
        });
        break;
      case 'openWallet':
        console.log(`Opening ${selectedPlayer.name}'s wallet`);
        socket.emit('requestWallet', { 
          targetId: selectedPlayer.id,
          playerId: socket.id
        });
        break;
      case 'pvpSwordAttack':
        console.log(`PVP Sword attack on ${selectedPlayer.name} - removed from interaction menu`);
        // PVP attacks are now handled by universal combat system (Spacebar/C keys)
        break;
      case 'pvpGunAttack':
        console.log(`PVP Gun attack on ${selectedPlayer.name} - removed from interaction menu`);
        // PVP attacks are now handled by universal combat system (Spacebar/C keys)
        break;
      default:
        break;
    }
    
    // Close the menu after action
    closeMenu();
  };

  // Handle server responses
  useEffect(() => {
    if (!socket) return;

    // Friend request received
    const handleFriendRequest = (data) => {
      console.log('Friend request received:', data);
      setFriendRequests(prev => [...prev, data]);
      // Show notification to user
      alert(`${data.senderName} sent you a friend request!`);
    };

    // Profile data received
    const handleProfileData = (data) => {
      console.log('Profile data received:', data);
      // Display profile data in a modal or new component
      alert(`Player profile for ${data.name}\nLevel: ${data.level}\nAchievements: ${data.achievements.join(', ')}`);
    };

    // Wallet/card binder data received
    const handleWalletData = (data) => {
      console.log('Wallet data received:', data);
      // Display wallet data in a modal or new component
      alert(`${data.name}'s Card Collection (${data.cards.length} cards)`);
      // Here you would show the actual 3x3 binder in a new window or modal
    };

    // Set up event listeners
    socket.on('friendRequest', handleFriendRequest);
    socket.on('playerProfile', handleProfileData);
    socket.on('playerWallet', handleWalletData);

    // Clean up
    return () => {
      socket.off('friendRequest', handleFriendRequest);
      socket.off('playerProfile', handleProfileData);
      socket.off('playerWallet', handleWalletData);
    };
  }, [socket]);

  // Preload monster sprites for better performance
  useEffect(() => {
    const monsterTypes = ['goblin', 'orc', 'dragon'];
    monsterTypes.forEach(monsterType => {
      const img = new Image();
      img.onload = () => console.log(`[SPRITE] Preloaded monster sprite: ${monsterType}`);
      img.onerror = (e) => console.error(`[SPRITE] Failed to preload monster sprite: ${monsterType}`, e);
      img.src = `/assets/characters/${monsterType}.png`;
    });
  }, []);

  // Display admin access screen first
  if (showAdminAccess) {
    return (
      <div className="login-page-container">
        <div className="login-content">
          <div className="admin-access-container">
            <h2 className="app-title">🔒 Beta Access Control</h2>
            <p className="app-subtitle">This is a private beta. Only invited users can access.</p>
            
            {adminAccessError && <div className="error-message">{adminAccessError}</div>}
            
            <div className="admin-access-form">
              <div className="hero-form-group">
                <label>Admin Password</label>
                <div className="hero-input-wrapper">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="hero-input"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAdminAccess();
                      }
                    }}
                  />
                  <div className="hero-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="admin-access-buttons">
                <button
                  type="button"
                  className="hero-button hero-button-primary"
                  onClick={handleAdminAccess}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                  Admin Access
                </button>
                
                <button
                  type="button"
                  className="hero-button hero-button-secondary"
                  onClick={handleSkipAdminAccess}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                  </svg>
                  Continue as User
                </button>
              </div>
              
              <div className="invited-users-info">
                <h4>🔐 Invited Beta Users:</h4>
                <div className="invited-users-list">
                  {invitedUsers.map(user => (
                    <div key={user.userId} className="invited-user-item">
                      <span className="user-id">{user.userId}</span>
                      <span className="user-name">({user.name})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show invite code screen
  if (showInviteCode) {
    return (
      <div className="login-page-container">
        <div className="login-content">
          <div className="admin-access-container">
            <h2 className="app-title">🎫 Invite Code Required</h2>
            <p className="app-subtitle">Please enter your invite code to access the beta</p>
            
            {inviteCodeError && <div className="error-message">{inviteCodeError}</div>}
            
            <div className="admin-access-form">
              <div className="hero-form-group">
                <label>Invite Code</label>
                <div className="hero-input-wrapper">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter your invite code"
                    className="hero-input"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleInviteCodeValidation();
                      }
                    }}
                  />
                  <div className="hero-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="admin-access-buttons">
                <button
                  type="button"
                  className="hero-button hero-button-primary"
                  onClick={handleInviteCodeValidation}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                  Verify Code
                </button>
                
                <button
                  type="button"
                  className="hero-button hero-button-secondary"
                  onClick={() => {
                    setShowInviteCode(false);
                    setShowAdminAccess(true);
                    setInviteCodeError('');
                    setInviteCode('');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                    <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clipRule="evenodd" />
                  </svg>
                  Back
                </button>
              </div>
              
              <div className="invited-users-info">
                <h4>🔑 Valid Invite Codes:</h4>
                <div className="invited-users-list">
                  {VALID_INVITE_CODES.map(code => (
                    <div key={code} className="invited-user-item">
                      <span className="user-id">{code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display login screen if not in a room
  if (!inRoom) {
    return (
      <div className="login-page-container">
        <div className="login-content">
          <div className="stepper-wrapper-outer">
            <Stepper
              initialStep={1}
              onStepChange={(step) => {
                console.log(step);
                // Clear any errors when changing steps
                setError('');
              }}
              onFinalStepCompleted={handleJoinRoom}
              backButtonText="Previous"
              nextButtonText="Next"
            >
              <Step>
                <h2 className="app-title">Welcome to TCG Verse</h2>
                <p className="app-subtitle">Meet, Chat, Belong—Anytime, Anywhere</p>
                <p className="version-info">v5.0</p>
                {error && <div className="error-message">{error}</div>}
                {successMessage && <div className="success-message">{successMessage}</div>}
                
                <div className="login-options">
                  <div className="login-option-buttons">
                    <button
                      type="button"
                      className={`hero-toggle-button ${loginMode === 'login' ? 'active' : ''}`}
                      onClick={() => {
                        setLoginMode('login');
                        setError('');
                        setSuccessMessage('');
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                        <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                      </svg>
                      Login
                    </button>
                    <button
                      type="button"
                      className={`hero-toggle-button ${loginMode === 'signup' ? 'active' : ''}`}
                      onClick={() => {
                        setLoginMode('signup');
                        setError('');
                        setSuccessMessage('');
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                        <path d="M6.25 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM3.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.363-.631v-.122z" />
                      </svg>
                      Join Us
                    </button>
                    <button
                      type="button"
                      className={`hero-toggle-button ${loginMode === 'guest' ? 'active' : ''}`}
                      onClick={() => {
                        setLoginMode('guest');
                        setError('');
                        setSuccessMessage('');
                        setRole('roleA'); // Auto-set role for guests
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                        <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                      </svg>
                      Guest
                    </button>
                  </div>
                  
                  {loginMode === 'login' && (
                    <div className="login-form">
                      <div className="hero-form-group">
                        <label>User ID</label>
                        <div className="hero-input-wrapper">
                          <input
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Enter your User ID"
                            className="hero-input"
                          />
                          <div className="hero-input-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="hero-form-group">
                        <label>Password</label>
                        <div className="hero-input-wrapper">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="hero-input"
                          />
                          <div className="hero-input-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {loginMode === 'signup' && (
                    <div className="signup-form">
                      <div className="hero-form-group">
                        <label>User ID</label>
                        <div className="hero-input-wrapper">
                          <input
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Choose a User ID"
                            className="hero-input"
                          />
                          <div className="hero-input-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="hero-form-group">
                        <label>Password</label>
                        <div className="hero-input-wrapper">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a password"
                            className="hero-input"
                          />
                          <div className="hero-input-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="hero-form-group">
                        <label>Email Address</label>
                        <div className="hero-input-wrapper">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="hero-input"
                          />
                          <div className="hero-input-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                              <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                              <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {loginMode === 'guest' && (
                    <div className="guest-info">
                      <div className="hero-message">
                        <p>You're entering as a guest. Just press Next to join with a randomly generated name. Your session will not be saved after you leave.</p>
                      </div>
                    </div>
                  )}
                </div>
              </Step>
              <Step>
                <h2 className="app-title">Let Everyone Know You Better!</h2>
                <p className="app-subtitle">Enter your details</p>
                {error && <div className="error-message">{error}</div>}
                <div className="hero-form-group">
                  <label>Your Display Name</label>
                  <div className="hero-input-wrapper">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={loginMode === 'guest' ? "Random guest name will be used" : "Enter your display name"}
                      className="hero-input"
                      disabled={loginMode === 'guest'} // Disable input if in guest mode
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
                      value={loginMode === 'guest' ? 'roleA' : role}
                      onChange={(e) => setRole(e.target.value)}
                      className="hero-select"
                      disabled={loginMode === 'guest'} // Disable selection for guests
                    >
                      <option value="">Select a role</option>
                      <option value="roleA">Role A</option>
                      <option value="roleB">Role B</option>
                    </select>
                    <div className="hero-select-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-icon">
                        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 00-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 01-.189-.866c0-.298.059-.605.189-.866zm-4.34 7.964a.75.75 0 01-1.061-1.06 5.236 5.236 0 013.73-1.538 5.236 5.236 0 013.695 1.538.75.75 0 11-1.061 1.06 3.736 3.736 0 00-2.639-1.098 3.736 3.736 0 00-2.664 1.098z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Step>
              <Step>
                <h2 className="app-title">Customize Your Digital DNA</h2>
                <p className="app-subtitle">Who you want to be today?</p>
                {error && <div className="error-message">{error}</div>}
                <div className="hero-form-group">
                  <label>What colour you're feeling today?</label>
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
                </div>
                
                <div className="hero-form-group">
                  <label>Choose your chat bubble style</label>
                  <div className="hero-border-style-picker">
                    {bubbleStyles.map(style => (
                      <div 
                        key={style.value}
                        className={`hero-border-option ${bubbleStyle === style.value ? 'active' : ''}`}
                        onClick={() => setBubbleStyle(style.value)}
                      >
                        <div 
                          className={`border-preview bubble-border-${style.value}`}
                          style={{ 
                            borderColor: '#000'
                          }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="hero-form-group">
                  <label>Choose your Character</label>
                  <CharacterSelector 
                    selectedSpriteId={spriteId}
                    onSelectSprite={(id) => setSpriteId(id)}
                  />
                </div>
              </Step>
              <Step>
                <h2>Room Options</h2>
                <p>Choose a room to join or create</p>
                {error && <div className="error-message">{error}</div>}
                
                {loginMode === 'guest' ? (
                  <div className="hero-message">
                    <p>As a guest, you'll automatically join the guest room. Just press Next to enter!</p>
                  </div>
                ) : (
                  <>
                    <div className="hero-form-group">
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
                  </>
                )}
                
                <div className="hero-form-group">
                  <div className="hero-summary">
                    <p><strong>Name:</strong> {name || 'Not set'}</p>
                    <p><strong>Role:</strong> {role ? (role === 'roleA' ? 'Role A' : 'Role B') : loginMode === 'guest' ? 'Role A (default)' : 'Not set'}</p>
                    {loginMode === 'guest' ? (
                      <p><strong>Room:</strong> Guest Room</p>
                    ) : (
                      <>
                        <p><strong>Room:</strong> {isCreatingRoom ? 'Creating new room' : 'Joining existing room'}</p>
                        <p><strong>Room Code:</strong> {roomId || 'Not set'}</p>
                      </>
                    )}
                  </div>
                </div>
              </Step>
            </Stepper>
          </div>
        </div>
      </div>
    );
  }

  // Game room with chat
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
              isVoiceChatEnabled={true}
            />
            
            {/* Admin Panel Button */}
            {isAdmin && (
              <button 
                className="admin-panel-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Admin panel button clicked!', { isAdmin, showAdminPanel });
                  setShowAdminPanel(true);
                }}
                title="Open Admin Panel"
                style={{ 
                  display: 'block',
                  backgroundColor: '#ff6b6b',
                  marginTop: '10px',
                  marginBottom: '10px',
                  padding: '10px 20px',
                  border: '2px solid #333',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'white',
                  width: '100%'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px', width: '16px', height: '16px' }}>
                  <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.128 5.5H4.5A2.25 2.25 0 002.25 7.75v8.5A2.25 2.25 0 004.5 18.5h15a2.25 2.25 0 002.25-2.25v-8.5A2.25 2.25 0 0019.5 5.5h-4.628l-.15-1.683A1.875 1.875 0 0012.922 2.25h-1.844zM10.5 8.25a3 3 0 116 0v3.75a.75.75 0 01-1.5 0V8.25a1.5 1.5 0 10-3 0v3.75a.75.75 0 01-1.5 0V8.25z" clipRule="evenodd" />
                </svg>
                Admin Panel
              </button>
            )}
            
            <button 
              className="hero-button hero-back-home-button" 
              onClick={handleBackToHome}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="hero-button-icon">
                <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1 .875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
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
            <p>Press <strong>SPACEBAR</strong> to pickup swords and attack monsters</p>
            <p>Press <strong>F</strong> to attack monsters, pickup items, or interact with players</p>
            <p>Press <strong>G</strong> to shoot guns</p>
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
                    cursor: player.id === socket?.id ? 'grab' : 'default',
                    zIndex: player.id === socket?.id ? 10 : 5
                  }}
                  onMouseDown={(e) => handleMouseDown(e, player.id)}
                  onTouchStart={(e) => handleMouseDown(e, player.id)}
                >
                  {/* Player name on top */}
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
                  
                  {/* PVP indicator */}
                  {pvpStatuses[player.id] && (
                    <div 
                      className="pvp-indicator"
                      style={{
                        position: 'absolute',
                        top: '-25px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '20px',
                        color: '#ff4444',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        zIndex: 15,
                        fontWeight: 'bold'
                      }}
                      title="PVP Mode Active"
                    >
                      💀
                    </div>
                  )}
                  
                  {/* Interaction menu when this player is selected */}
                  {showInteractionMenu && selectedPlayer && selectedPlayer.id === player.id && (
                    <div className={`horizontal-menu ${menuFadeout ? 'fadeout' : ''}`}>
                      <div className="menu-options">
                        {/* Add Friend */}
                        <button 
                          className="menu-option"
                          onClick={(e) => handleInteraction('addFriend', e)}
                          title="Add Friend"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="menu-icon">
                            <path d="M6.25 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM3.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.363-.63l-.001-.122zM19.75 7.5a.75.75 0 00-1.5 0v2.25H16a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0v-2.25H22a.75.75 0 000-1.5h-2.25V7.5z" />
                          </svg>
                        </button>
                        
                        {/* Profile */}
                        <button 
                          className="menu-option"
                          onClick={(e) => handleInteraction('viewProfile', e)}
                          title="View Profile"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="menu-icon">
                            <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {/* Wallet */}
                        <button 
                          className="menu-option"
                          onClick={(e) => handleInteraction('openWallet', e)}
                          title="View Wallet"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="menu-icon">
                            <path d="M2.273 5.625A4.483 4.483 0 015.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 3H5.25a3 3 0 00-2.977 2.625zM2.273 8.625A4.483 4.483 0 015.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0018.75 6H5.25a3 3 0 00-2.977 2.625zM5.25 9a3 3 0 00-3 3v6a3 3 0 003 3h13.5a3 3 0 003-3v-6a3 3 0 00-3-3H15a.75.75 0 00-.75.75 2.25 2.25 0 01-4.5 0A.75.75 0 009 9H5.25z" />
                          </svg>
                        </button>
                        

                      </div>
                    </div>
                  )}
                  
                  {/* Character sprite */}
                  <SpriteManager 
                    spriteSheet={getSpriteConfigById(playerSpriteId).defaultSprite}
                    animation={animation}
                    direction={direction}
                    config={getSpriteConfigById(playerSpriteId)}
                    size={80}
                    tintColor={playerSpriteId === 'character1' || playerSpriteId === 'character2' ? (player.bubbleColor || '#4a90e2') : ''}
                  />
                  
                  {/* HP Bar */}
                  <div className="player-hp-bar" style={{
                    position: 'absolute',
                    bottom: '-15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60px',
                    height: '6px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '3px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    zIndex: 10
                  }}>
                    <div 
                      className="hp-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, ((playerStats?.[player.id]?.hp || playerStats?.hp || 100) / (playerStats?.[player.id]?.maxHp || playerStats?.maxHp || 100)) * 100))}%`,
                        height: '100%',
                        background: 'linear-gradient(to right, #ff4444, #ffaa00, #4CAF50)',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                      }}
                    ></div>
                  </div>
                  
                  {/* Sword swing animation */}
                  {player.id === socket?.id && isAttacking && (
                    <div 
                      className="sword-swing"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '60px',
                        height: '4px',
                        backgroundColor: '#silver',
                        background: 'linear-gradient(90deg, #C0C0C0, #E0E0E0, #C0C0C0)',
                        borderRadius: '2px',
                        transformOrigin: 'left center',
                        transform: `translate(-50%, -50%) rotate(${swordSwingAngle}deg)`,
                        zIndex: 15,
                        boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
                        transition: 'transform 0.1s ease-out'
                      }}
                    >
                      {/* Sword handle */}
                      <div 
                        style={{
                          position: 'absolute',
                          left: '-8px',
                          top: '-6px',
                          width: '16px',
                          height: '16px',
                          backgroundColor: '#8B4513',
                          borderRadius: '50%',
                          border: '2px solid #654321'
                        }}
                      />
                      {/* Sword tip */}
                      <div 
                        style={{
                          position: 'absolute',
                          right: '-4px',
                          top: '-2px',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#C0C0C0',
                          clipPath: 'polygon(0 50%, 100% 0, 100% 100%)'
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Shadow beneath the sprite */}
                  <div className="sprite-shadow"></div>
                  
                  {/* Attack range indicator for current player */}
                  {player.id === socket?.id && monsters.length > 0 && (
                    <div 
                      className="player-attack-range"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '120px',
                        height: '120px',
                        border: '2px dashed rgba(255, 255, 0, 0.3)',
                        borderRadius: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        zIndex: 1,
                        opacity: 0.5
                      }}
                    />
                  )}
                  
                  {/* Chat bubbles */}
                  {chatMessages.map((msg, index) => {
                    if (index < 3) { // Show max 3 messages
                      return (
                        <div
                          key={index}
                          className={`player-chat-bubble bubble-border-${player.bubbleStyle || 'solid'}`}
                          data-message-index={index}
                          style={{
                            top: calculateBubblePosition(index, msg.text),
                            backgroundColor: 'white',
                            backgroundImage: `linear-gradient(to bottom, ${player.bubbleColor}22, ${player.bubbleColor}22), linear-gradient(to bottom, white, white)`,
                            borderStyle: player.bubbleStyle || 'solid',
                            borderWidth: player.bubbleStyle === 'none' ? 0 : '3px',
                            borderColor: 'rgba(0, 0, 0, 0.3)'
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
            
            {/* Monster rendering */}
            {monsters.map(monster => {
              const myPosition = playerPositions[socket?.id];
              const isInRange = myPosition && isInAttackRange(myPosition, monster.position);
              
              return (
                <div 
                  key={monster.id}
                  id={`monster-${monster.id}`}
                  className={`monster ${isInRange ? 'in-range' : ''}`}
                  style={{
                    left: `${monster.position.x}px`,
                    top: `${monster.position.y}px`,
                    cursor: isInRange ? 'pointer' : 'default'
                  }}
                  onClick={() => isInRange && attackMonster(monster.id)}
                >
                  {/* Monster name and HP bar */}
                  <div className="monster-info">
                    <div className="monster-name">{monster.name}</div>
                    <div className="monster-hp-bar">
                      <div 
                        className="monster-hp-fill"
                        style={{
                          width: `${(monster.hp / monster.maxHp) * 100}%`,
                          backgroundColor: monster.hp > monster.maxHp * 0.5 ? '#4CAF50' : monster.hp > monster.maxHp * 0.25 ? '#FF9800' : '#F44336'
                        }}
                      ></div>
                    </div>
                    <div className="monster-hp-text">{monster.hp}/{monster.maxHp} HP</div>
                  </div>
                  
                  {/* Monster sprite using actual image - Updated for production */}
                  <div 
                    className="monster-sprite"
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      border: '3px solid #333',
                      backgroundImage: `url('/assets/characters/${monster.id}.png')`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  />
                  
                  {/* Attack range indicator */}
                  {isInRange && (
                    <div className="attack-range-indicator">
                      <div className="range-circle"></div>
                      <div className="attack-prompt">Click to Attack!</div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Sword rendering */}
            {swords.map(sword => {
              const myPosition = playerPositions[socket?.id];
              const isInRange = myPosition && calculateDistance(myPosition, sword.position) <= 60;
              
              return (
                <div 
                  key={sword.id}
                  id={`sword-${sword.id}`}
                  className={`sword ${isInRange ? 'in-range' : ''}`}
                  style={{
                    left: `${sword.position.x}px`,
                    top: `${sword.position.y}px`,
                    cursor: isInRange ? 'pointer' : 'default'
                  }}
                  onClick={() => isInRange && pickupSword(sword.id)}
                >
                  {/* Sword name */}
                  <div className="sword-info">
                    <div className="sword-name">{sword.name}</div>
                    <div className="sword-damage">+{sword.damage} ATK</div>
                  </div>
                  
                  {/* Sword sprite - simple shape */}
                  <div 
                    className="sword-sprite"
                    style={{
                      backgroundColor: sword.color,
                      width: '30px',
                      height: '50px',
                      borderRadius: '2px',
                      border: '3px solid #333',
                      position: 'relative',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      transform: 'rotate(45deg)',
                      margin: 'auto'
                    }}
                  >
                    {/* Sword handle */}
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '12px',
                        height: '16px',
                        backgroundColor: '#8B4513',
                        borderRadius: '2px',
                        border: '1px solid #654321'
                      }}
                    />
                    {/* Sword tip */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '0',
                        height: '0',
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderBottom: `8px solid ${sword.color}`
                      }}
                    />
                  </div>
                  
                  {/* Pickup range indicator */}
                  {isInRange && (
                    <div className="pickup-range-indicator">
                      <div className="range-circle"></div>
                      <div className="pickup-prompt">Click to Pickup!</div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Gun rendering */}
            {guns.map(gun => {
              const myPosition = playerPositions[socket?.id];
              const distance = myPosition ? calculateDistance(myPosition, gun.position) : Infinity;
              const isInRange = distance <= 60;
              
              console.log(`Gun ${gun.id}: position ${JSON.stringify(gun.position)}, my position ${JSON.stringify(myPosition)}, distance: ${distance}, in range: ${isInRange}`);
              
              return (
                <div 
                  key={gun.id}
                  id={`gun-${gun.id}`}
                  className={`gun ${isInRange ? 'in-range' : ''}`}
                  style={{
                    left: `${gun.position.x}px`,
                    top: `${gun.position.y}px`,
                    cursor: isInRange ? 'pointer' : 'default',
                    position: 'absolute',
                    zIndex: 100
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`=== GUN CLICK DEBUG ===`);
                    console.log(`Gun ${gun.id} clicked`);
                    console.log(`Gun position:`, gun.position);
                    console.log(`My position:`, myPosition);
                    console.log(`Distance: ${distance}px`);
                    console.log(`In range: ${isInRange}`);
                    console.log(`Socket connected: ${!!socket}`);
                    console.log(`In room: ${inRoom}`);
                    console.log(`Socket ID: ${socket?.id}`);
                    console.log(`Event target:`, e.target);
                    console.log(`Event current target:`, e.currentTarget);
                    
                    if (!socket || !inRoom) {
                      console.log(`Cannot pick up gun - not connected or not in room`);
                      addCombatMessage('Cannot pick up gun - not connected!', 'warning');
                      return;
                    }
                    
                    if (isInRange) {
                      console.log(`Attempting to pick up gun ${gun.id}`);
                      pickupGun(gun.id);
                    } else {
                      console.log(`Gun ${gun.id} clicked but not in range (distance: ${distance}px)`);
                      addCombatMessage(`Too far from gun! (${Math.round(distance)}px away)`, 'warning');
                    }
                    console.log(`=== GUN CLICK COMPLETE ===`);
                  }}
                >
                  {/* Gun name and stats */}
                  <div className="gun-info" style={{
                    position: 'absolute',
                    top: '-60px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    zIndex: 101,
                    border: '1px solid #333'
                  }}>
                    <div className="gun-name" style={{ fontWeight: 'bold', color: '#FFD700' }}>{gun.name}</div>
                    <div className="gun-damage" style={{ color: '#FF6B6B' }}>+{gun.damage} DMG</div>
                    <div className="gun-ammo" style={{ color: '#4CAF50' }}>{gun.ammo} ammo</div>
                    <div className="gun-rarity" style={{ color: gun.rarity === 'rare' ? '#FFD700' : gun.rarity === 'uncommon' ? '#9370DB' : '#C0C0C0' }}>
                      {gun.rarity.toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Gun sprite - simple shape */}
                  <div 
                    className="gun-sprite"
                    style={{
                      backgroundColor: gun.color,
                      width: '40px',
                      height: '20px',
                      borderRadius: '4px',
                      border: '2px solid #333',
                      position: 'relative',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      margin: 'auto',
                      cursor: isInRange ? 'pointer' : 'default'
                    }}
                  >
                    {/* Gun barrel */}
                    <div 
                      style={{
                        position: 'absolute',
                        right: '-8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '8px',
                        backgroundColor: '#666',
                        borderRadius: '2px',
                        border: '1px solid #444'
                      }}
                    />
                    {/* Gun grip */}
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '8px',
                        height: '12px',
                        backgroundColor: '#8B4513',
                        borderRadius: '2px',
                        border: '1px solid #654321'
                      }}
                    />
                  </div>
                  
                  {/* Pickup range indicator */}
                  {isInRange && (
                    <div className="pickup-range-indicator" style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '120px',
                      height: '120px',
                      border: '2px solid #4CAF50',
                      borderRadius: '50%',
                      pointerEvents: 'none',
                      animation: 'pulse 1s infinite'
                    }}>
                      <div className="pickup-prompt" style={{
                        position: 'absolute',
                        top: '-30px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#4CAF50',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}>
                        Click to Pickup!
                      </div>
                    </div>
                  )}
                  
                  {/* Distance indicator for debugging */}
                  {!isInRange && (
                    <div style={{
                      position: 'absolute',
                      top: '-40px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(255, 0, 0, 0.8)',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      whiteSpace: 'nowrap'
                    }}>
                      {Math.round(distance)}px
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Projectile rendering */}
            {projectiles.map(projectile => {
              console.log(`Rendering projectile ${projectile.id} at position:`, projectile.position);
              return (
                <div
                  key={projectile.id}
                  className="projectile"
                  style={{
                    left: `${projectile.position.x}px`,
                    top: `${projectile.position.y}px`,
                    position: 'absolute',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#FFD700',
                    borderRadius: '50%',
                    boxShadow: '0 0 12px #FFD700, 0 0 24px #FFD700, 0 0 36px #FFD700',
                    animation: 'projectileGlow 0.3s ease-in-out infinite alternate',
                    zIndex: 1000,
                    pointerEvents: 'none'
                  }}
                />
              );
            })}
          </div>
          
          {/* Background settings manager */}
          <BackgroundManager onApplyBackground={handleApplyBackground} />
          
          {/* Combat UI */}
          <div className="combat-ui">
            {/* Player Stats */}
            <div className="player-stats-panel">
              <div className="stats-header">
                <h3>Combat Stats</h3>
                <button 
                  className="toggle-combat-btn"
                  onClick={() => setShowCombatUI(!showCombatUI)}
                >
                  {showCombatUI ? 'Hide' : 'Show'} Combat
                </button>
              </div>
              
              {showCombatUI && (
                <div className="stats-content">
                  <div className="stat-row">
                    <span className="stat-label">Level:</span>
                    <span className="stat-value">{playerStats?.level || 1}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">HP:</span>
                    <span className="stat-value">
                      {playerStats?.hp || 100}/{playerStats?.maxHp || 100}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Attack:</span>
                    <span className="stat-value">{playerStats?.attack || 10}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">EXP:</span>
                    <span className="stat-value">
                      {playerStats?.exp || 0}/{playerStats?.expToNextLevel || 100}
                    </span>
                  </div>
                  
                  {/* Sword status */}
                  <div className="stat-row">
                    <span className="stat-label">Weapon:</span>
                    <span className="stat-value">
                      {playerInventory.hasSword ? (
                        <span style={{ color: '#FFD700' }}>
                          ⚔️ {playerInventory.swordType ? playerInventory.swordType.replace('_', ' ').toUpperCase() : 'SWORD'}
                        </span>
                      ) : (
                        <span style={{ color: '#ccc' }}>None</span>
                      )}
                    </span>
                  </div>
                  
                  {/* Gun status */}
                  <div className="stat-row">
                    <span className="stat-label">Gun:</span>
                    <span className="stat-value">
                      {playerGun && playerGun.hasGun ? (
                        <span style={{ color: '#FF6B6B' }}>
                          🔫 {playerGun.gunType ? playerGun.gunType.replace('_', ' ').toUpperCase() : 'GUN'} ({playerGun.ammo} ammo)
                        </span>
                      ) : (
                        <span style={{ color: '#ccc' }}>None</span>
                      )}
                    </span>
                  </div>
                  
                  {/* HP Bar */}
                  <div className="hp-bar">
                    <div 
                      className="hp-fill"
                      style={{
                        width: `${((playerStats?.hp || 100) / (playerStats?.maxHp || 100)) * 100}%`,
                        backgroundColor: (playerStats?.hp || 100) > (playerStats?.maxHp || 100) * 0.5 ? '#4CAF50' : (playerStats?.hp || 100) > (playerStats?.maxHp || 100) * 0.25 ? '#FF9800' : '#F44336'
                      }}
                    ></div>
                  </div>
                  
                  {/* EXP Bar */}
                  <div className="exp-bar">
                    <div 
                      className="exp-fill"
                      style={{
                        width: `${((playerStats?.exp || 0) / (playerStats?.expToNextLevel || 100)) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Combat Log */}
            {showCombatUI && (
              <div className="combat-log">
                <h4>Combat Log</h4>
                <div className="log-messages">
                  {combatMessages.map(msg => (
                    <div key={msg.id} className={`log-message log-${msg.type}`}>
                      {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                    className={`hero-message-bubble bubble-border-${msg.bubbleStyle || 'solid'}`}
                    style={{
                      backgroundColor: 'white',
                      '--bubble-color': msg.bubbleColor || '#333',
                      backgroundImage: `linear-gradient(to bottom, ${msg.bubbleColor}22, ${msg.bubbleColor}22), linear-gradient(to bottom, white, white)`,
                      borderStyle: msg.bubbleStyle || 'solid',
                      borderWidth: msg.bubbleStyle === 'none' ? 0 : '3px',
                      borderColor: 'rgba(0, 0, 0, 0.3)'
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
                    <path d="M3.478 2.404a.75.75 0 0 0 0 .941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
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

      {/* Audio Controls */}
      {inRoom && (
        <div className="audio-controls" style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '10px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div style={{ marginBottom: '5px' }}>
            <button 
              onClick={() => audioManager.setMuted(!audioManager.isMuted)}
              style={{
                background: audioManager.isMuted ? '#ff4444' : '#4CAF50',
                border: 'none',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              {audioManager.isMuted ? '🔇 Unmute' : '🔊 Mute'}
            </button>
            <span>Music: {Math.round(audioManager.musicVolume * 100)}%</span>
          </div>
          <div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={audioManager.musicVolume}
              onChange={(e) => audioManager.setMusicVolume(parseFloat(e.target.value))}
              style={{ width: '100px', marginRight: '10px' }}
            />
            <span>SFX: {Math.round(audioManager.sfxVolume * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={audioManager.sfxVolume}
              onChange={(e) => audioManager.setSFXVolume(parseFloat(e.target.value))}
              style={{ width: '100px' }}
            />
          </div>
        </div>
      )}

      {/* PVP Controls */}
      {console.log('Rendering PVP controls:', { inRoom, myPvpStatus })}
      {inRoom && (
        <div className="pvp-controls" onClick={(e) => console.log('PVP container clicked!', e)}>
          <div style={{ marginBottom: '5px' }}>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('PVP button clicked!', e);
                togglePVP();
              }}
              onMouseDown={(e) => console.log('PVP button mousedown!', e)}
              onMouseUp={(e) => console.log('PVP button mouseup!', e)}
              style={{
                background: myPvpStatus ? '#ff4444' : '#4CAF50',
                position: 'relative',
                zIndex: 1001
              }}
            >
              {myPvpStatus ? '💀 PVP ON' : '🛡️ PVP OFF'}
            </button>
            
            {/* PVP Debug button */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('=== MANUAL PVP DEBUG TEST ===');
                console.log('My PVP status:', myPvpStatus);
                console.log('All PVP statuses:', pvpStatuses);
                console.log('Players in room:', players.length);
                console.log('My position:', playerPositions[socket?.id]);
                console.log('Socket connected:', !!socket);
                console.log('In room:', inRoom);
                
                // Test sword swing
                if (playerInventory.hasSword) {
                  console.log('Testing sword swing...');
                  performSwordSwing();
                } else {
                  console.log('No sword equipped for testing');
                }
              }}
              style={{
                background: '#ffaa00',
                border: 'none',
                color: 'white',
                padding: '8px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginLeft: '10px',
                position: 'relative',
                zIndex: 1001
              }}
            >
              🔍 DEBUG PVP
            </button>
          </div>
          <div style={{ fontSize: '10px', opacity: 0.8 }}>
            {myPvpStatus ? 'You can attack other PVP players' : 'You are safe from PVP attacks'}
          </div>
        </div>
      )}

      {/* Add VoiceChat component at bottom of return statement before final closing div */}
      {inRoom && roomId && (
        <VoiceChat
          socket={socket}
          inRoom={inRoom}
          roomId={roomId}
          players={players}
          currentPlayerId={socket?.id}
        />
      )}

      {/* Proximity interaction prompt */}
      {showProximityPrompt && nearbyPlayers.length > 0 && (
        <div className="proximity-prompt">
          Press F to interact with nearby player
        </div>
      )}

      {/* Remove the standalone menu since it's now part of the player element */}
      
      {/* Revival Popup */}
      {showRevivalPopup && isDead && (
        <div className="revival-popup-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="revival-popup" style={{
            background: 'white',
            padding: '30px',
            borderRadius: '15px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div className="revival-content">
              <h2 style={{ color: '#d32f2f', marginBottom: '20px' }}>💀 You Have Died!</h2>
              <p style={{ marginBottom: '20px', fontSize: '16px' }}>Your HP has reached 0. Click the button below to revive.</p>
              <div className="revival-stats" style={{ marginBottom: '25px' }}>
                <p><strong>Current HP:</strong> {playerStats?.hp || 0}/{playerStats?.maxHp || 100}</p>
              </div>
              <button 
                className="revival-button"
                onClick={handleRevival}
                style={{
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '20px 40px',
                  borderRadius: '10px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
                  transition: 'all 0.3s ease',
                  minWidth: '200px'
                }}
                onMouseOver={(e) => e.target.style.background = '#45a049'}
                onMouseOut={(e) => e.target.style.background = '#4CAF50'}
              >
                🔄 Revive Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {console.log('Rendering AdminPanel:', { showAdminPanel, isAdmin })}
      <AdminPanel 
        socket={socket}
        isVisible={showAdminPanel}
        onClose={() => {
          console.log('Closing admin panel');
          setShowAdminPanel(false);
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}

export default App; 