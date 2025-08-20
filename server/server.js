const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from the React build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const players = new Map();
const rooms = new Map();
const roomBackgrounds = new Map(); // Store background settings for each room
const voiceChatUsers = new Map(); // Store users who are in voice chat
const talkingUsers = new Map(); // Store users who are currently talking

// Monster system data structures
const roomMonsters = new Map(); // Store monsters for each room: roomId -> Map<monsterId, monsterData>
const playerStats = new Map(); // Store player combat stats: playerId -> {hp, maxHp, attack, level, exp}
const monsterSpawnTimers = new Map(); // Store spawn timers for each room: roomId -> timer

// Monster movement system
const monsterMovementTimers = new Map(); // Track movement timers per room

// Sword system data structures
const roomSwords = new Map(); // Store swords for each room: roomId -> Map<swordId, swordData>
const playerInventories = new Map(); // Store player inventories: playerId -> {hasSword: boolean, swordType: string}
const swordSpawnTimers = new Map(); // Store sword spawn timers for each room: roomId -> timer

// Gun system data structures
const roomGuns = new Map(); // Store guns for each room: roomId -> Map<gunId, gunData>
const playerGunInventories = new Map(); // Store player gun inventories: playerId -> {hasGun: boolean, gunType: string, ammo: number}
const gunSpawnTimers = new Map(); // Store gun spawn timers for each room: roomId -> timer
const projectiles = new Map(); // Store active projectiles: roomId -> Map<projectileId, projectileData>

// Machine gun continuous firing system
const machineGunFiringStates = new Map(); // Track which players are continuously firing: playerId -> {isFiring: boolean, lastShot: timestamp}
const machineGunTimers = new Map(); // Store continuous firing timers: playerId -> timer

// PVP system data structures
const playerPVPStatus = new Map(); // Track PVP status for each player: playerId -> {isPVP: boolean, timestamp: number}
const pvpDamageCooldown = new Map(); // Track PVP damage cooldowns: playerId -> {lastDamageTime: timestamp}

// Player profiles data store
const playerProfiles = {};
// Friendship data
const friendships = {
  // playerID: [friendID1, friendID2, ...]
};
// Friend requests
const friendRequests = {
  // receiverID: [{senderId, senderName}, ...]
};
// Player wallets/card collections
const playerWallets = {};

// Monster configuration
const MONSTER_CONFIG = {
  spawnInterval: 10000, // 10 seconds between spawns
  maxMonstersPerRoom: 5,
  monsterTypes: [
    { id: 'goblin', name: 'Goblin', hp: 30, attack: 5, exp: 10, color: '#8B4513', type: 'small' },
    { id: 'orc', name: 'Orc', hp: 50, attack: 8, exp: 20, color: '#228B22', type: 'medium' },
    { id: 'dragon', name: 'Dragon', hp: 100, attack: 15, exp: 50, color: '#DC143C', type: 'boss' }
  ]
};

// Sword configuration
const SWORD_CONFIG = {
  spawnInterval: 8000, // 8 seconds between sword spawns (more frequent)
  maxSwordsPerRoom: 1, // Only 1 sword at a time to make it more visible
  swordTypes: [
    { id: 'basic_sword', name: 'Basic Sword', damage: 15, color: '#C0C0C0', rarity: 'common' },
    { id: 'iron_sword', name: 'Iron Sword', damage: 25, color: '#696969', rarity: 'uncommon' },
    { id: 'magic_sword', name: 'Magic Sword', damage: 40, color: '#9370DB', rarity: 'rare' }
  ]
};

// PVP configuration
const PVP_CONFIG = {
  damageCooldown: 2000, // 2 seconds between PVP damage
  swordDamage: 25, // Sword damage to other players
  gunDamage: 30, // Gun damage to other players
  maxPVPDistance: 80, // Maximum distance for PVP attacks
  pvpIndicator: '💀' // Red skull emoji for PVP indicator
};

// Gun configuration
const GUN_CONFIG = {
  spawnInterval: 12000, // 12 seconds between gun spawns
  maxGunsPerRoom: 1, // Only 1 gun at a time
  gunTypes: [
    { 
      id: 'pistol', 
      name: 'Pistol', 
      damage: 20, 
      color: '#8B4513', 
      rarity: 'common',
      ammo: 10,
      fireRate: 1000, // 1 second between shots
      projectileSpeed: 400,
      projectileCount: 1,
      spread: 0
    },
    { 
      id: 'shotgun', 
      name: 'Shotgun', 
      damage: 15, 
      color: '#2F4F4F', 
      rarity: 'uncommon',
      ammo: 6,
      fireRate: 2000, // 2 seconds between shots
      projectileSpeed: 350,
      projectileCount: 5,
      spread: 30 // degrees
    },
    { 
      id: 'machine_gun', 
      name: 'Machine Gun', 
      damage: 12, 
      color: '#DC143C', 
      rarity: 'rare',
      ammo: 30,
      fireRate: 300, // 0.3 seconds between shots
      projectileSpeed: 450,
      projectileCount: 1,
      spread: 0
    }
  ]
};

// Admin configuration
const ADMIN_USERS = ['admin', 'takochn']; // Users who have admin access
const adminStats = {
  totalSpawns: 0,
  totalKills: 0
};

// Default player stats
const DEFAULT_PLAYER_STATS = {
  hp: 100,
  maxHp: 100,
  attack: 10,
  level: 1,
  exp: 0,
  expToNextLevel: 100
};

// Player states (direction, animation, etc.)
const playerStates = new Map();

// Monster system functions
const generateMonsterId = () => `monster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getRandomMonsterType = () => {
  const randomIndex = Math.floor(Math.random() * MONSTER_CONFIG.monsterTypes.length);
  return MONSTER_CONFIG.monsterTypes[randomIndex];
};

const getRandomPosition = (gameAreaWidth = 800, gameAreaHeight = 600) => {
  return {
    x: Math.random() * (gameAreaWidth - 100) + 50,
    y: Math.random() * (gameAreaHeight - 100) + 50
  };
};

const spawnMonster = (roomId) => {
  if (!roomMonsters.has(roomId)) {
    roomMonsters.set(roomId, new Map());
  }
  
  const roomMonsterMap = roomMonsters.get(roomId);
  
  // Check if room has max monsters
  if (roomMonsterMap.size >= MONSTER_CONFIG.maxMonstersPerRoom) {
    return null;
  }
  
  const monsterType = getRandomMonsterType();
  const monsterId = generateMonsterId();
  const position = getRandomPosition();
  
  const monster = {
    id: monsterId,
    type: monsterType.id,
    name: monsterType.name,
    hp: monsterType.hp,
    maxHp: monsterType.hp,
    attack: monsterType.attack,
    exp: monsterType.exp,
    color: monsterType.color,
    position: position,
    lastAttack: 0
  };
  
  roomMonsterMap.set(monsterId, monster);
  
  // Broadcast monster spawn to all players in the room
  io.to(roomId).emit('monsterSpawned', monster);
  
  // Update admin stats
  adminStats.totalSpawns++;
  
  console.log(`Monster spawned in room ${roomId}:`, monster.name, 'at', position);
  return monster;
};

const startMonsterSpawning = (roomId) => {
  // Clear existing timer if any
  if (monsterSpawnTimers.has(roomId)) {
    console.log(`Clearing existing spawn timer for room ${roomId}`);
    const existingTimer = monsterSpawnTimers.get(roomId);
    clearInterval(existingTimer);
    monsterSpawnTimers.delete(roomId);
  }
  
  // Start new spawn timer
  const timer = setInterval(() => {
    spawnMonster(roomId);
  }, MONSTER_CONFIG.spawnInterval);
  
  monsterSpawnTimers.set(roomId, timer);
  console.log(`Started monster spawning for room ${roomId} with interval ${MONSTER_CONFIG.spawnInterval}ms`);
};

const stopMonsterSpawning = (roomId) => {
  if (monsterSpawnTimers.has(roomId)) {
    const timer = monsterSpawnTimers.get(roomId);
    clearInterval(timer);
    monsterSpawnTimers.delete(roomId);
    console.log(`Stopped monster spawning for room ${roomId}`);
  } else {
    console.log(`No active spawn timer found for room ${roomId}`);
  }
};

// Monster movement system
const moveMonster = (monster, gameAreaWidth = 800, gameAreaHeight = 600) => {
  // Calculate new random position within bounds with larger movement range
  const movementRange = 150; // Increased from 100 to make movement more visible
  const newX = Math.max(50, Math.min(gameAreaWidth - 50, monster.position.x + (Math.random() - 0.5) * movementRange));
  const newY = Math.max(50, Math.min(gameAreaHeight - 50, monster.position.y + (Math.random() - 0.5) * movementRange));
  
  const newPosition = { x: newX, y: newY };
  
  // Update monster position
  monster.position = newPosition;
  
  return newPosition;
};

const startMonsterMovement = (roomId) => {
  // Clear existing movement timer if any
  if (monsterMovementTimers.has(roomId)) {
    const existingTimer = monsterMovementTimers.get(roomId);
    clearInterval(existingTimer);
    monsterMovementTimers.delete(roomId);
  }
  
  // Start new movement timer
  const timer = setInterval(() => {
    if (roomMonsters.has(roomId)) {
      const roomMonsterMap = roomMonsters.get(roomId);
      
      console.log(`Moving monsters in room ${roomId}, found ${roomMonsterMap.size} monsters`);
      
      // Move each monster in the room
      roomMonsterMap.forEach((monster, monsterId) => {
        const oldPosition = { ...monster.position };
        const newPosition = moveMonster(monster);
        
        console.log(`Monster ${monsterId} (${monster.name}) moved from ${JSON.stringify(oldPosition)} to ${JSON.stringify(newPosition)}`);
        
        // Broadcast monster movement to all players
        io.to(roomId).emit('monsterMoved', {
          monsterId: monsterId,
          position: newPosition
        });
      });
    } else {
      console.log(`No monsters found in room ${roomId} for movement`);
    }
    
    // Projectile updates are now handled by a separate timer for better performance
  }, 2000); // Move monsters every 2 seconds
  
  monsterMovementTimers.set(roomId, timer);
  console.log(`Started monster movement for room ${roomId}`);
};

const stopMonsterMovement = (roomId) => {
  if (monsterMovementTimers.has(roomId)) {
    const timer = monsterMovementTimers.get(roomId);
    clearInterval(timer);
    monsterMovementTimers.delete(roomId);
    console.log(`Stopped monster movement for room ${roomId}`);
  }
};

// Sword system functions
const generateSwordId = () => `sword_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getRandomSwordType = () => {
  const randomIndex = Math.floor(Math.random() * SWORD_CONFIG.swordTypes.length);
  return SWORD_CONFIG.swordTypes[randomIndex];
};

const spawnSword = (roomId) => {
  console.log(`Attempting to spawn sword in room ${roomId}`);
  
  if (!roomSwords.has(roomId)) {
    roomSwords.set(roomId, new Map());
    console.log(`Created new sword map for room ${roomId}`);
  }
  
  const roomSwordMap = roomSwords.get(roomId);
  console.log(`Room ${roomId} currently has ${roomSwordMap.size} swords, max allowed: ${SWORD_CONFIG.maxSwordsPerRoom}`);
  
  // Check if room has max swords
  if (roomSwordMap.size >= SWORD_CONFIG.maxSwordsPerRoom) {
    console.log(`Room ${roomId} has max swords (${roomSwordMap.size}), cannot spawn more`);
    return null;
  }
  
  const swordType = getRandomSwordType();
  const swordId = generateSwordId();
  
  // Spawn sword in the middle of the map (400x300 is the center of 800x600)
  const position = { x: 400, y: 300 };
  
  const sword = {
    id: swordId,
    type: swordType.id,
    name: swordType.name,
    damage: swordType.damage,
    color: swordType.color,
    rarity: swordType.rarity,
    position: position
  };
  
  roomSwordMap.set(swordId, sword);
  
  // Broadcast sword spawn to all players in the room
  console.log(`Broadcasting sword spawn to room ${roomId}:`, sword.name);
  io.to(roomId).emit('swordSpawned', sword);
  
  console.log(`Sword spawned in room ${roomId}:`, sword.name, 'at', position);
  return sword;
};

const startSwordSpawning = (roomId) => {
  // Clear existing timer if any
  if (swordSpawnTimers.has(roomId)) {
    console.log(`Clearing existing sword spawn timer for room ${roomId}`);
    const existingTimer = swordSpawnTimers.get(roomId);
    clearInterval(existingTimer);
    swordSpawnTimers.delete(roomId);
  }
  
  // Start new spawn timer
  const timer = setInterval(() => {
    console.log(`Sword spawn timer triggered for room ${roomId}`);
    const sword = spawnSword(roomId);
    if (sword) {
      console.log(`Successfully spawned sword in room ${roomId}:`, sword.name);
    } else {
      console.log(`Failed to spawn sword in room ${roomId} - room may have max swords`);
    }
  }, SWORD_CONFIG.spawnInterval);
  
  swordSpawnTimers.set(roomId, timer);
  console.log(`Started sword spawning for room ${roomId} with interval ${SWORD_CONFIG.spawnInterval}ms`);
  
  // Spawn initial sword immediately
  console.log(`Spawning initial sword for room ${roomId}`);
  const initialSword = spawnSword(roomId);
  if (initialSword) {
    console.log(`Initial sword spawned in room ${roomId}:`, initialSword.name);
  } else {
    console.log(`Failed to spawn initial sword in room ${roomId}`);
  }
};

const stopSwordSpawning = (roomId) => {
  if (swordSpawnTimers.has(roomId)) {
    const timer = swordSpawnTimers.get(roomId);
    clearInterval(timer);
    swordSpawnTimers.delete(roomId);
    console.log(`Stopped sword spawning for room ${roomId}`);
  } else {
    console.log(`No active sword spawn timer found for room ${roomId}`);
  }
};

const handleSwordPickup = (playerId, swordId, roomId) => {
  const player = players.get(playerId);
  if (!player) {
    console.log(`Player ${playerId} not found for sword pickup`);
    return;
  }
  
  const roomSwordMap = roomSwords.get(roomId);
  if (!roomSwordMap || !roomSwordMap.has(swordId)) {
    console.log(`Sword ${swordId} not found in room ${roomId}`);
    return;
  }
  
  const sword = roomSwordMap.get(swordId);
  const playerPosition = player.position;
  
  // Check if player is close enough to pick up the sword
  const distance = calculateDistance(playerPosition, sword.position);
  if (distance > 60) { // 60px pickup range
    console.log(`Player ${playerId} too far from sword ${swordId} (distance: ${distance})`);
    return;
  }
  
  // Remove sword from room
  roomSwordMap.delete(swordId);
  
  // Update player inventory
  const playerInventory = playerInventories.get(playerId) || { hasSword: false, swordType: null };
  playerInventory.hasSword = true;
  playerInventory.swordType = sword.type;
  playerInventories.set(playerId, playerInventory);
  
  // Update player stats with sword damage bonus
  const playerStat = playerStats.get(playerId) || { ...DEFAULT_PLAYER_STATS };
  playerStat.attack = DEFAULT_PLAYER_STATS.attack + sword.damage;
  playerStats.set(playerId, playerStat);
  
  // Broadcast sword pickup to all players
  io.to(roomId).emit('swordPickedUp', {
    swordId: swordId,
    playerId: playerId,
    playerName: player.name,
    swordName: sword.name
  });
  
  // Send updated inventory to the player who picked up the sword
  io.to(playerId).emit('inventoryUpdated', playerInventory);
  
  console.log(`Player ${playerId} (${player.name}) picked up ${sword.name} in room ${roomId}`);
};

// Gun system functions
const generateGunId = () => `gun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getRandomGunType = () => {
  const randomIndex = Math.floor(Math.random() * GUN_CONFIG.gunTypes.length);
  return GUN_CONFIG.gunTypes[randomIndex];
};

const spawnGun = (roomId) => {
  console.log(`=== GUN SPAWN DEBUG ===`);
  console.log(`Attempting to spawn gun in room ${roomId}`);
  
  if (!roomGuns.has(roomId)) {
    roomGuns.set(roomId, new Map());
    console.log(`Created new gun map for room ${roomId}`);
  }
  
  const roomGunMap = roomGuns.get(roomId);
  console.log(`Room ${roomId} currently has ${roomGunMap.size} guns, max allowed: ${GUN_CONFIG.maxGunsPerRoom}`);
  
  // Check if room has max guns
  if (roomGunMap.size >= GUN_CONFIG.maxGunsPerRoom) {
    console.log(`Room ${roomId} has max guns (${roomGunMap.size}), cannot spawn more`);
    return null;
  }
  
  const gunType = getRandomGunType();
  const gunId = generateGunId();
  const position = getRandomPosition();
  
  const gun = {
    id: gunId,
    type: gunType.id,
    name: gunType.name,
    damage: gunType.damage,
    color: gunType.color,
    rarity: gunType.rarity,
    ammo: gunType.ammo,
    fireRate: gunType.fireRate,
    projectileSpeed: gunType.projectileSpeed,
    projectileCount: gunType.projectileCount,
    spread: gunType.spread,
    position: position
  };
  
  roomGunMap.set(gunId, gun);
  
  // Broadcast gun spawn to all players in the room
  console.log(`Broadcasting gun spawn to room ${roomId}:`, gun.name);
  io.to(roomId).emit('gunSpawned', gun);
  
  console.log(`Gun spawned in room ${roomId}:`, gun.name, 'at', position);
  console.log(`=== GUN SPAWN COMPLETE ===`);
  return gun;
};

const startGunSpawning = (roomId) => {
  // Clear existing timer if any
  if (gunSpawnTimers.has(roomId)) {
    console.log(`Clearing existing gun spawn timer for room ${roomId}`);
    const existingTimer = gunSpawnTimers.get(roomId);
    clearInterval(existingTimer);
    gunSpawnTimers.delete(roomId);
  }
  
  // Start new spawn timer
  const timer = setInterval(() => {
    console.log(`Gun spawn timer triggered for room ${roomId}`);
    const gun = spawnGun(roomId);
    if (gun) {
      console.log(`Successfully spawned gun in room ${roomId}:`, gun.name);
    } else {
      console.log(`Failed to spawn gun in room ${roomId} - room may have max guns`);
    }
  }, GUN_CONFIG.spawnInterval);
  
  gunSpawnTimers.set(roomId, timer);
  console.log(`Started gun spawning for room ${roomId} with interval ${GUN_CONFIG.spawnInterval}ms`);
  
  // Spawn initial gun immediately
  console.log(`Spawning initial gun for room ${roomId}`);
  const initialGun = spawnGun(roomId);
  if (initialGun) {
    console.log(`Initial gun spawned in room ${roomId}:`, initialGun.name);
  } else {
    console.log(`Failed to spawn initial gun in room ${roomId}`);
  }
};

const stopGunSpawning = (roomId) => {
  if (gunSpawnTimers.has(roomId)) {
    const timer = gunSpawnTimers.get(roomId);
    clearInterval(timer);
    gunSpawnTimers.delete(roomId);
    console.log(`Stopped gun spawning for room ${roomId}`);
  } else {
    console.log(`No active gun spawn timer found for room ${roomId}`);
  }
};

const handleGunPickup = (playerId, gunId, roomId) => {
  console.log(`=== GUN PICKUP DEBUG ===`);
  console.log(`Player ${playerId} attempting to pick up gun ${gunId} in room ${roomId}`);
  
  const player = players.get(playerId);
  if (!player) {
    console.log(`Player ${playerId} not found for gun pickup`);
    return;
  }
  
  console.log(`Player found: ${player.name}, position: ${JSON.stringify(player.position)}`);
  
  const roomGunMap = roomGuns.get(roomId);
  if (!roomGunMap || !roomGunMap.has(gunId)) {
    console.log(`Gun ${gunId} not found in room ${roomId}`);
    console.log(`Room guns: ${roomGunMap ? Array.from(roomGunMap.keys()) : 'null'}`);
    return;
  }
  
  const gun = roomGunMap.get(gunId);
  console.log(`Gun found: ${gun.name}, position: ${JSON.stringify(gun.position)}`);
  
  const playerPosition = player.position;
  
  // Check if player is close enough to pick up the gun
  const distance = calculateDistance(playerPosition, gun.position);
  console.log(`Distance between player and gun: ${distance}px (max: 60px)`);
  
  if (distance > 60) { // 60px pickup range
    console.log(`Player ${playerId} too far from gun ${gunId} (distance: ${distance})`);
    return;
  }
  
  console.log(`Player is in range! Proceeding with pickup...`);
  
  // Remove gun from room
  roomGunMap.delete(gunId);
  
  // Update player gun inventory
  const playerGunInventory = playerGunInventories.get(playerId) || { hasGun: false, gunType: null, ammo: 0 };
  playerGunInventory.hasGun = true;
  playerGunInventory.gunType = gun.type;
  playerGunInventory.ammo = gun.ammo;
  playerGunInventory.lastShot = 0;
  playerGunInventories.set(playerId, playerGunInventory);
  
  // Broadcast gun pickup to all players
  io.to(roomId).emit('gunPickedUp', {
    gunId: gunId,
    playerId: playerId,
    playerName: player.name,
    gunName: gun.name
  });
  
  // Send updated gun inventory to the player who picked up the gun
  io.to(playerId).emit('gunInventoryUpdated', playerGunInventory);
  
  console.log(`Player ${playerId} (${player.name}) picked up ${gun.name} in room ${roomId}`);
  console.log(`=== GUN PICKUP COMPLETE ===`);
};

const generateProjectileId = () => `projectile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const createProjectile = (playerId, gunType, startPosition, direction) => {
  const gunConfig = GUN_CONFIG.gunTypes.find(g => g.id === gunType);
  if (!gunConfig) return null;
  
  const projectileId = generateProjectileId();
  const speed = gunConfig.projectileSpeed || 400; // Increased speed for better visibility
  
  // Calculate velocity based on direction (direction should be normalized)
  const velocity = {
    x: direction.x * speed,
    y: direction.y * speed
  };
  
  console.log(`Creating projectile ${projectileId} with velocity:`, velocity, 'speed:', speed, 'direction:', direction);
  
  const projectile = {
    id: projectileId,
    playerId: playerId,
    gunType: gunType,
    damage: gunConfig.damage,
    position: { ...startPosition },
    velocity: velocity,
    createdAt: Date.now(),
    lifetime: 3000, // 3 seconds lifetime (increased for better visibility)
    active: true // Track if projectile is still active
  };
  
  return projectile;
};

const updateProjectiles = (roomId) => {
  try {
    if (!projectiles.has(roomId)) return;
    
    const roomProjectiles = projectiles.get(roomId);
    const currentTime = Date.now();
    const projectilesToRemove = [];
    
    // Limit logging to prevent spam
    if (roomProjectiles.size > 0) {
      console.log(`Updating ${roomProjectiles.size} projectiles for room ${roomId}`);
    }
    
    roomProjectiles.forEach((projectile, projectileId) => {
      try {
        if (!projectile.active) {
          projectilesToRemove.push(projectileId);
          return;
        }
        
        // Update position with velocity
        const deltaTime = 0.05; // 50ms intervals
        projectile.position.x += projectile.velocity.x * deltaTime;
        projectile.position.y += projectile.velocity.y * deltaTime;
        
        // Apply minimal velocity decay (friction) - reduced for better projectile movement
        const friction = 0.99; // 1% velocity loss per update (much less aggressive)
        projectile.velocity.x *= friction;
        projectile.velocity.y *= friction;
        
        // Check if projectile has lost too much velocity
        const minVelocity = 5; // Reduced minimum velocity threshold for longer projectile life
        if (Math.abs(projectile.velocity.x) < minVelocity && Math.abs(projectile.velocity.y) < minVelocity) {
          console.log(`Projectile ${projectileId} lost velocity, removing`);
          projectile.active = false;
          projectilesToRemove.push(projectileId);
          return;
        }
        
        // Check lifetime
        if (currentTime - projectile.createdAt > projectile.lifetime) {
          console.log(`Projectile ${projectileId} expired, removing`);
          projectile.active = false;
          projectilesToRemove.push(projectileId);
          return;
        }
        
        // Check collision with monsters
        const roomMonsterMap = roomMonsters.get(roomId);
        if (roomMonsterMap) {
          for (const [monsterId, monster] of roomMonsterMap) {
            const distance = Math.sqrt(
              Math.pow(projectile.position.x - monster.position.x, 2) +
              Math.pow(projectile.position.y - monster.position.y, 2)
            );
            
            if (distance <= 30) { // Collision radius
              console.log(`Projectile ${projectileId} hit monster ${monster.id} (${monster.type})`);
              
              // Damage the monster
              monster.hp -= projectile.damage;
              console.log(`Monster ${monster.id} hp reduced to ${monster.hp}`);
              
              // Remove the projectile
              projectile.active = false;
              projectilesToRemove.push(projectileId);
              
              // Check if monster is killed
              if (monster.hp <= 0) {
                console.log(`Monster ${monster.id} (${monster.name}) killed by projectile`);
                
                // Remove monster from room
                roomMonsterMap.delete(monsterId);
                
                // Broadcast monster death
                const attacker = players.get(projectile.playerId);
                io.to(roomId).emit('monsterKilled', {
                  monsterId: monster.id,
                  killerId: projectile.playerId,
                  killerName: attacker ? attacker.name : 'Unknown Player',
                  position: monster.position
                });
              } else {
                // Broadcast monster damage
                const attacker = players.get(projectile.playerId);
                io.to(roomId).emit('monsterDamaged', {
                  monsterId: monster.id,
                  damage: projectile.damage,
                  health: monster.hp,
                  position: monster.position,
                  attackerName: attacker ? attacker.name : 'Unknown Player'
                });
              }
              
              break; // Exit loop after hitting one monster
            }
          }
        }
      } catch (error) {
        console.error(`Error updating projectile ${projectileId}:`, error);
        // Mark projectile for removal on error
        projectile.active = false;
        projectilesToRemove.push(projectileId);
      }
  });
  
  // Remove expired/lost velocity projectiles
  projectilesToRemove.forEach(projectileId => {
    roomProjectiles.delete(projectileId);
    console.log(`Removed projectile ${projectileId}`);
  });
  
  // Broadcast updated projectiles to room
  if (roomProjectiles.size > 0) {
    const activeProjectiles = Array.from(roomProjectiles.values()).filter(p => p.active);
    io.to(roomId).emit('projectilesUpdated', activeProjectiles);
  }
  } catch (error) {
    console.error(`Error in updateProjectiles for room ${roomId}:`, error);
  }
};

const handleGunShoot = (socket, data) => {
  try {
    const playerId = socket.id;
    const player = players.get(playerId);
    
    if (!player) {
      console.log(`Player ${playerId} not found for gun shoot`);
      socket.emit('gunShootFailed', { reason: 'Player not found' });
      return;
    }
    
    const roomId = player.room;
    if (!roomId) {
      console.log(`Player ${playerId} not in a room for gun shoot`);
      socket.emit('gunShootFailed', { reason: 'Not in a room' });
      return;
    }
    
    // Get player's gun
    const playerGun = playerGunInventories.get(playerId);
    if (!playerGun || !playerGun.hasGun) {
      console.log(`Player ${playerId} has no gun to shoot`);
      socket.emit('gunShootFailed', { reason: 'No gun equipped' });
      return;
    }
    
    // Check ammo
    if (playerGun.ammo <= 0) {
      console.log(`Player ${playerId} has no ammo`);
      socket.emit('gunShootFailed', { reason: 'No ammo' });
      return;
    }
    
    // Get player's current position and last facing direction
    const playerPosition = player.position;
    if (!playerPosition) {
      console.log(`Player ${playerId} position not found`);
      socket.emit('gunShootFailed', { reason: 'Position not found' });
      return;
    }
    
    // Get player's last facing direction from their state
    const playerState = playerStates.get(playerId) || { direction: 'down' };
    let direction;
    
    // Convert direction string to vector
    switch (playerState.direction) {
      case 'up':
        direction = { x: 0, y: -1 };
        break;
      case 'down':
        direction = { x: 0, y: 1 };
        break;
      case 'left':
        direction = { x: -1, y: 0 };
        break;
      case 'right':
        direction = { x: 1, y: 0 };
        break;
      default:
        direction = { x: 0, y: 1 }; // Default to down
    }
    
    console.log(`Player ${playerId} shooting gun ${playerGun.gunType} in direction:`, direction);
    
    // Get gun configuration
    const gunConfig = GUN_CONFIG.gunTypes.find(g => g.id === playerGun.gunType);
    if (!gunConfig) {
      console.log(`Gun config not found for ${playerGun.gunType}`);
      socket.emit('gunShootFailed', { reason: 'Invalid gun type' });
      return;
    }
    
    // Initialize projectile collection
    if (!projectiles.has(roomId)) {
      projectiles.set(roomId, new Map());
    }
    
    const createdProjectiles = [];
    
    // Create projectiles based on gun type
    if (gunConfig.id === 'shotgun') {
      // Shotgun: Create 5 projectiles in a fan shape
      const spreadAngle = gunConfig.spread || 30; // degrees
      const angleStep = spreadAngle / (gunConfig.projectileCount - 1);
      const startAngle = -spreadAngle / 2;
      
      for (let i = 0; i < gunConfig.projectileCount; i++) {
        const currentAngle = startAngle + (i * angleStep);
        const radians = (currentAngle * Math.PI) / 180;
        
        // Calculate spread direction
        const spreadDirection = {
          x: direction.x * Math.cos(radians) - direction.y * Math.sin(radians),
          y: direction.x * Math.sin(radians) + direction.y * Math.cos(radians)
        };
        
        const projectile = createProjectile(playerId, playerGun.gunType, playerPosition, spreadDirection);
        if (projectile) {
          projectiles.get(roomId).set(projectile.id, projectile);
          createdProjectiles.push(projectile);
        }
      }
    } else {
      // Pistol and Machine Gun: Create single projectile
      const projectile = createProjectile(playerId, playerGun.gunType, playerPosition, direction);
      if (projectile) {
        projectiles.get(roomId).set(projectile.id, projectile);
        createdProjectiles.push(projectile);
      }
    }
    
    if (createdProjectiles.length === 0) {
      console.log(`Failed to create projectiles for player ${playerId}`);
      socket.emit('gunShootFailed', { reason: 'Failed to create projectiles' });
      return;
    }
    
    // Start projectile updates for this room if not already running
    startProjectileUpdates(roomId);
    
    // Reduce ammo
    playerGun.ammo--;
    console.log(`Player ${playerId} ammo reduced to ${playerGun.ammo}`);
    
    // Broadcast all created projectiles to room
    createdProjectiles.forEach(projectile => {
      io.to(roomId).emit('projectileCreated', projectile);
    });
    
    // Update player's gun state
    playerGunInventories.set(playerId, playerGun);
    
    // Broadcast updated gun state to player
    socket.emit('gunUpdated', playerGun);
    
    console.log(`${createdProjectiles.length} projectiles created for player ${playerId} in room ${roomId}`);
  } catch (error) {
    console.error('Error in handleGunShoot:', error);
    socket.emit('gunShootFailed', { reason: 'Server error' });
  }
};

// Admin functions
const isAdmin = (userId) => {
  return ADMIN_USERS.includes(userId);
};

const updateMonsterConfig = (newConfig) => {
  Object.assign(MONSTER_CONFIG, newConfig);
  console.log('Monster configuration updated:', MONSTER_CONFIG);
};

const getAdminStats = (roomId) => {
  const activeMonsters = roomMonsters.has(roomId) ? roomMonsters.get(roomId).size : 0;
  return {
    activeMonsters,
    totalSpawns: adminStats.totalSpawns,
    totalKills: adminStats.totalKills
  };
};

const adminSpawnMonster = (roomId) => {
  const monster = spawnMonster(roomId);
  if (monster) {
    adminStats.totalSpawns++;
    console.log(`Admin spawned monster in room ${roomId}:`, monster.name);
  }
  return monster;
};

const adminClearMonsters = (roomId) => {
  if (roomMonsters.has(roomId)) {
    const roomMonsterMap = roomMonsters.get(roomId);
    const monsterCount = roomMonsterMap.size;
    roomMonsterMap.clear();
    
    // Broadcast monster removal to all players
    io.to(roomId).emit('adminClearedMonsters', { count: monsterCount });
    
    console.log(`Admin cleared ${monsterCount} monsters from room ${roomId}`);
    return monsterCount;
  }
  return 0;
};

const calculateDistance = (pos1, pos2) => {
  return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
};

const isInAttackRange = (playerPos, monsterPos, range = 60) => {
  return calculateDistance(playerPos, monsterPos) <= range;
};

const handlePlayerAttack = (playerId, monsterId, roomId) => {
  const player = players.get(playerId);
  const playerStat = playerStats.get(playerId) || DEFAULT_PLAYER_STATS;
  const roomMonsterMap = roomMonsters.get(roomId);
  
  if (!player || !roomMonsterMap || !roomMonsterMap.has(monsterId)) {
    return { success: false, message: 'Invalid target' };
  }
  
  const monster = roomMonsterMap.get(monsterId);
  
  // Check if player is in attack range
  if (!isInAttackRange(player.position, monster.position)) {
    return { success: false, message: 'Target out of range' };
  }
  
  // Calculate damage
  const damage = playerStat.attack + Math.floor(Math.random() * 5); // Add some randomness
  monster.hp -= damage;
  
  // Broadcast attack to all players
  io.to(roomId).emit('monsterDamaged', {
    monsterId: monsterId,
    damage: damage,
    remainingHp: monster.hp,
    attackerId: playerId,
    attackerName: player.name
  });
  
  // Check if monster is dead
  if (monster.hp <= 0) {
    // Give exp to player
    const newExp = playerStat.exp + monster.exp;
    let newLevel = playerStat.level;
    let newExpToNextLevel = playerStat.expToNextLevel;
    
    // Check for level up
    if (newExp >= playerStat.expToNextLevel) {
      newLevel++;
      newExpToNextLevel = newLevel * 100; // Simple level progression
    }
    
    // Update player stats
    playerStats.set(playerId, {
      ...playerStat,
      exp: newExp,
      level: newLevel,
      expToNextLevel: newExpToNextLevel
    });
    
    // Remove monster
    roomMonsterMap.delete(monsterId);
    
    // Broadcast monster death
    io.to(roomId).emit('monsterKilled', {
      monsterId: monsterId,
      monsterName: monster.name,
      expGained: monster.exp,
      killerId: playerId,
      killerName: player.name,
      playerStats: playerStats.get(playerId)
    });
    
    // Update admin stats
    adminStats.totalKills++;
    
    console.log(`Monster ${monster.name} killed by ${player.name} in room ${roomId}`);
    return { success: true, message: 'Monster killed', expGained: monster.exp };
  }
  
  return { success: true, message: 'Monster damaged', damage: damage };
};

const handleMonsterAttack = (monsterId, playerId, roomId) => {
  const player = players.get(playerId);
  const playerStat = playerStats.get(playerId) || DEFAULT_PLAYER_STATS;
  const roomMonsterMap = roomMonsters.get(roomId);
  
  if (!player || !roomMonsterMap || !roomMonsterMap.has(monsterId)) {
    return { success: false, message: 'Invalid target' };
  }
  
  const monster = roomMonsterMap.get(monsterId);
  
  // Check if monster is in attack range
  if (!isInAttackRange(monster.position, player.position)) {
    return { success: false, message: 'Player out of range' };
  }
  
  // Check attack cooldown (monsters attack every 3 seconds)
  const now = Date.now();
  if (now - monster.lastAttack < 3000) {
    return { success: false, message: 'Attack on cooldown' };
  }
  
  // Calculate damage
  const damage = monster.attack + Math.floor(Math.random() * 3);
  const newHp = Math.max(0, playerStat.hp - damage);
  
  // Update player stats
  playerStats.set(playerId, {
    ...playerStat,
    hp: newHp
  });
  
  // Update monster last attack time
  monster.lastAttack = now;
  
  // Broadcast monster attack to all players
  io.to(roomId).emit('playerDamaged', {
    playerId: playerId,
    playerName: player.name,
    damage: damage,
    remainingHp: newHp,
    monsterId: monsterId,
    monsterName: monster.name
  });
  
  // Check if player is dead
  if (newHp <= 0) {
    // Respawn player at safe location
    const respawnPosition = { x: 50, y: 100 };
    player.position = respawnPosition;
    
    // Reset player HP
    playerStats.set(playerId, {
      ...playerStats.get(playerId),
      hp: playerStat.maxHp
    });
    
    // Broadcast player death and respawn
    io.to(roomId).emit('playerDied', {
      playerId: playerId,
      playerName: player.name,
      respawnPosition: respawnPosition,
      playerStats: playerStats.get(playerId)
    });
    
    console.log(`Player ${player.name} died and respawned in room ${roomId}`);
    return { success: true, message: 'Player died and respawned' };
  }
  
  return { success: true, message: 'Player damaged', damage: damage };
};

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

// Projectile update timers
const projectileUpdateTimers = new Map();

const startProjectileUpdates = (roomId) => {
  // Clear existing timer if any
  if (projectileUpdateTimers.has(roomId)) {
    const existingTimer = projectileUpdateTimers.get(roomId);
    clearInterval(existingTimer);
    projectileUpdateTimers.delete(roomId);
  }
  
  // Start new projectile update timer (60 FPS = 16.67ms intervals)
  const timer = setInterval(() => {
    updateProjectiles(roomId);
  }, 50); // Update every 50ms for smooth projectile movement
  
  projectileUpdateTimers.set(roomId, timer);
  console.log(`Started projectile updates for room ${roomId}`);
};

const stopProjectileUpdates = (roomId) => {
  if (projectileUpdateTimers.has(roomId)) {
    const timer = projectileUpdateTimers.get(roomId);
    clearInterval(timer);
    projectileUpdateTimers.delete(roomId);
    console.log(`Stopped projectile updates for room ${roomId}`);
  }
};

// Machine gun continuous firing functions
const startMachineGunFiring = (playerId) => {
  const player = players.get(playerId);
  const playerGun = playerGunInventories.get(playerId);
  
  if (!player || !playerGun || !playerGun.hasGun || playerGun.gunType !== 'machine_gun') {
    return;
  }
  
  const gunConfig = GUN_CONFIG.gunTypes.find(g => g.id === 'machine_gun');
  if (!gunConfig) return;
  
  // Set firing state
  machineGunFiringStates.set(playerId, {
    isFiring: true,
    lastShot: 0
  });
  
  // Start continuous firing timer
  const timer = setInterval(() => {
    const firingState = machineGunFiringStates.get(playerId);
    if (!firingState || !firingState.isFiring) {
      stopMachineGunFiring(playerId);
      return;
    }
    
    const now = Date.now();
    if (now - firingState.lastShot >= gunConfig.fireRate) {
      // Check if player still has ammo
      if (playerGun.ammo > 0) {
        // Fire a shot
        const playerState = playerStates.get(playerId) || { direction: 'down' };
        let direction;
        
        switch (playerState.direction) {
          case 'up': direction = { x: 0, y: -1 }; break;
          case 'down': direction = { x: 0, y: 1 }; break;
          case 'left': direction = { x: -1, y: 0 }; break;
          case 'right': direction = { x: 1, y: 0 }; break;
          default: direction = { x: 0, y: 1 };
        }
        
        // Create and fire projectile
        const projectile = createProjectile(playerId, 'machine_gun', player.position, direction);
        if (projectile) {
          const roomId = player.room;
          if (!projectiles.has(roomId)) {
            projectiles.set(roomId, new Map());
          }
          projectiles.get(roomId).set(projectile.id, projectile);
          startProjectileUpdates(roomId);
          
          // Reduce ammo
          playerGun.ammo--;
          playerGunInventories.set(playerId, playerGun);
          
          // Broadcast
          io.to(roomId).emit('projectileCreated', projectile);
          io.to(playerId).emit('gunUpdated', playerGun);
          
          // Update last shot time
          firingState.lastShot = now;
          machineGunFiringStates.set(playerId, firingState);
        }
      } else {
        // Out of ammo, stop firing
        stopMachineGunFiring(playerId);
      }
    }
  }, 50); // Check every 50ms for smooth firing
  
  machineGunTimers.set(playerId, timer);
  console.log(`Started machine gun continuous firing for player ${playerId}`);
};

const stopMachineGunFiring = (playerId) => {
  // Clear firing state
  machineGunFiringStates.delete(playerId);
  
  // Clear timer
  if (machineGunTimers.has(playerId)) {
    const timer = machineGunTimers.get(playerId);
    clearInterval(timer);
    machineGunTimers.delete(playerId);
    console.log(`Stopped machine gun continuous firing for player ${playerId}`);
  }
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Initialize player on connection
  players.set(socket.id, {
    id: socket.id,
    name: null,
    role: null,
    room: null,
    position: { x: 50, y: 100 },
    spriteId: '8bit', // Default sprite
    animation: 'idle', // Default animation
    direction: 'down'  // Default direction
  });

  // Initialize demo profile data for this player
  playerProfiles[socket.id] = {
    name: 'Unknown Player',
    level: 1,
    achievements: ['Newcomer'],
    joinDate: new Date().toISOString().split('T')[0],
    games: 0,
    wins: 0
  };

  // Initialize demo wallet/card collection for this player
  playerWallets[socket.id] = {
    name: 'Unknown Player',
    cards: [
      { id: 'card1', name: 'Basic Card', rarity: 'common', image: 'card1.png' },
      { id: 'card2', name: 'Basic Card 2', rarity: 'common', image: 'card2.png' }
    ]
  };

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
    player.userId = data.userId; // Store userId for admin checking
    
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
    
    // Initialize player stats if not exists
    if (!playerStats.has(socket.id)) {
      playerStats.set(socket.id, { ...DEFAULT_PLAYER_STATS });
    }
    
    // Start monster spawning for this room if not already started
    if (!monsterSpawnTimers.has(roomId)) {
      startMonsterSpawning(roomId);
    }
    
    // Start monster movement for this room if not already started
    if (!monsterMovementTimers.has(roomId)) {
      startMonsterMovement(roomId);
    }
    
    // Start sword spawning for this room if not already started
    if (!swordSpawnTimers.has(roomId)) {
      startSwordSpawning(roomId);
    }
    
    // Start gun spawning for this room if not already started
    if (!gunSpawnTimers.has(roomId)) {
      startGunSpawning(roomId);
    }
    
    // Start projectile updates for this room if not already started
    if (!projectileUpdateTimers.has(roomId)) {
      startProjectileUpdates(roomId);
    }
    
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
    
    // Get current monsters in the room
    const roomMonsterMap = roomMonsters.get(roomId) || new Map();
    const currentMonsters = Array.from(roomMonsterMap.values());
    
    // Get current swords in the room
    const roomSwordMap = roomSwords.get(roomId) || new Map();
    const currentSwords = Array.from(roomSwordMap.values());
    
    // Get current guns in the room
    const roomGunMap = roomGuns.get(roomId) || new Map();
    const currentGuns = Array.from(roomGunMap.values());
    
    // Get player stats
    const playerStat = playerStats.get(socket.id) || DEFAULT_PLAYER_STATS;
    
    // Get player inventory
    const playerInventory = playerInventories.get(socket.id) || { hasSword: false, swordType: null };
    
    // Get player gun inventory
    const playerGunInventory = playerGunInventories.get(socket.id) || { hasGun: false, gunType: null, ammo: 0 };
    
    // Get PVP status for all players in the room
    const pvpStatuses = {};
    roomPlayers.forEach(roomPlayer => {
      const pvpStatus = playerPVPStatus.get(roomPlayer.id) || { isPVP: false, timestamp: 0 };
      pvpStatuses[roomPlayer.id] = pvpStatus.isPVP;
    });
    
    // Send room info to player, including background settings if available
    socket.emit('roomJoined', {
      roomId: roomId,
      players: roomPlayers,
      backgroundSettings: backgroundSettings || null, // Send background settings if available
      monsters: currentMonsters, // Send current monsters
      swords: currentSwords, // Send current swords
      guns: currentGuns, // Send current guns
      playerStats: playerStat, // Send player stats
      playerInventory: playerInventory, // Send player inventory
      playerGunInventory: playerGunInventory, // Send player gun inventory
      pvpStatuses: pvpStatuses // Send PVP statuses for all players
    });
    console.log(`Sent room joined data to ${socket.id} with background:`, backgroundSettings ? 'YES' : 'NO', 'monsters:', currentMonsters.length);
    
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
    
    // Update player state for projectile shooting
    if (data.direction) {
      updatePlayerState(socket.id, { direction: data.direction });
    }
    
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

  // Handle friend request
  socket.on('friendRequest', (data) => {
    const { targetId, senderName } = data;
    
    // Make sure target exists
    if (!players.has(targetId)) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    console.log(`Friend request from ${socket.id} (${senderName}) to ${targetId}`);
    
    // Store the friend request
    if (!friendRequests[targetId]) {
      friendRequests[targetId] = [];
    }
    
    // Check if request already exists
    const existingRequest = friendRequests[targetId].find(req => req.senderId === socket.id);
    if (existingRequest) {
      socket.emit('error', { message: 'Friend request already sent' });
      return;
    }
    
    // Add the request
    friendRequests[targetId].push({
      senderId: socket.id,
      senderName: senderName || players.get(socket.id).name || 'Unknown Player'
    });
    
    // Notify the target player
    io.to(targetId).emit('friendRequest', {
      senderId: socket.id,
      senderName: senderName || players.get(socket.id).name || 'Unknown Player'
    });
    
    // Confirm to sender
    socket.emit('requestSent', { success: true, targetId });
  });
  
  // Handle accepting friend request
  socket.on('acceptFriendRequest', (data) => {
    const { senderId } = data;
    
    console.log(`${socket.id} accepting friend request from ${senderId}`);
    
    // Check if request exists
    if (!friendRequests[socket.id] || 
        !friendRequests[socket.id].find(req => req.senderId === senderId)) {
      socket.emit('error', { message: 'No friend request found' });
      return;
    }
    
    // Initialize friendship arrays if needed
    if (!friendships[socket.id]) friendships[socket.id] = [];
    if (!friendships[senderId]) friendships[senderId] = [];
    
    // Add to friendships (both ways)
    friendships[socket.id].push(senderId);
    friendships[senderId].push(socket.id);
    
    // Remove the request
    friendRequests[socket.id] = friendRequests[socket.id].filter(
      req => req.senderId !== senderId
    );
    
    // Notify both players
    socket.emit('friendRequestAccepted', {
      friendId: senderId,
      friendName: players.get(senderId).name || 'Unknown Player'
    });
    
    io.to(senderId).emit('friendshipConfirmed', {
      friendId: socket.id,
      friendName: players.get(socket.id).name || 'Unknown Player'
    });
  });
  
  // Handle rejecting friend request
  socket.on('rejectFriendRequest', (data) => {
    const { senderId } = data;
    
    // Remove the request
    if (friendRequests[socket.id]) {
      friendRequests[socket.id] = friendRequests[socket.id].filter(
        req => req.senderId !== senderId
      );
    }
    
    // Notify sender (optional)
    io.to(senderId).emit('friendRequestRejected', {
      receiverId: socket.id
    });
  });
  
  // Handle get player profile
  socket.on('getPlayerProfile', (data) => {
    const { playerId } = data;
    
    // Make sure player exists
    if (!players.has(playerId)) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    console.log(`Profile request for player ${playerId}`);
    
    // Get or create profile
    let profile = playerProfiles[playerId] || {
      name: players.get(playerId).name || 'Unknown Player',
      level: 1,
      achievements: ['Newcomer'],
      joinDate: new Date().toISOString().split('T')[0],
      games: 0,
      wins: 0
    };
    
    // Return profile to requester
    socket.emit('playerProfile', {
      playerId,
      name: profile.name,
      level: profile.level,
      achievements: profile.achievements,
      joinDate: profile.joinDate,
      games: profile.games,
      wins: profile.wins
    });
  });
  
  // Handle open player wallet
  socket.on('openPlayerWallet', (data) => {
    const { playerId } = data;
    
    // Make sure player exists
    if (!players.has(playerId)) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    
    console.log(`Wallet request for player ${playerId}`);
    
    // Get or create wallet data
    let wallet = playerWallets[playerId] || {
      name: players.get(playerId).name || 'Unknown Player',
      cards: []
    };
    
    // Return wallet to requester
    socket.emit('playerWallet', {
      playerId,
      name: wallet.name,
      cards: wallet.cards
    });
  });

  // Monster system socket event handlers
  
  // Handle player attack on monster
  socket.on('attackMonster', (data) => {
    const { monsterId } = data;
    const player = players.get(socket.id);
    
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    const result = handlePlayerAttack(socket.id, monsterId, player.room);
    socket.emit('attackResult', result);
  });
  
  // Handle monster attack on player (triggered by proximity)
  socket.on('monsterAttackPlayer', (data) => {
    const { monsterId } = data;
    const player = players.get(socket.id);
    
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    const result = handleMonsterAttack(monsterId, socket.id, player.room);
    socket.emit('monsterAttackResult', result);
  });
  
  // Handle player stats request
  socket.on('getPlayerStats', () => {
    const playerStat = playerStats.get(socket.id) || DEFAULT_PLAYER_STATS;
    socket.emit('playerStats', playerStat);
  });
  
  // Handle monster list request
  socket.on('getMonsters', () => {
    const player = players.get(socket.id);
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    const roomMonsterMap = roomMonsters.get(player.room) || new Map();
    const monsters = Array.from(roomMonsterMap.values());
    socket.emit('monsterList', monsters);
  });
  
  // Sword system socket event handlers
  
  // Handle sword pickup
  socket.on('pickupSword', (data) => {
    const { swordId } = data;
    const player = players.get(socket.id);
    
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    handleSwordPickup(socket.id, swordId, player.room);
  });
  
  // Handle sword list request
  socket.on('getSwords', () => {
    const player = players.get(socket.id);
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    const roomSwordMap = roomSwords.get(player.room) || new Map();
    const swords = Array.from(roomSwordMap.values());
    socket.emit('swordList', swords);
  });

  // Gun system socket event handlers
  
  // Handle gun pickup
  socket.on('pickupGun', (data) => {
    console.log(`=== SOCKET GUN PICKUP DEBUG ===`);
    console.log(`Received pickupGun event:`, data);
    
    const { gunId } = data;
    const player = players.get(socket.id);
    
    console.log(`Player found:`, !!player);
    console.log(`Player data:`, player);
    
    if (!player || !player.room) {
      console.log(`Player not found or not in room`);
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    console.log(`Calling handleGunPickup with: socket.id=${socket.id}, gunId=${gunId}, room=${player.room}`);
    handleGunPickup(socket.id, gunId, player.room);
    console.log(`=== SOCKET GUN PICKUP COMPLETE ===`);
  });

  // Handle gun shoot
  socket.on('shootGun', (data) => {
    const { direction } = data;
    const player = players.get(socket.id);
    
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    handleGunShoot(socket, data);
  });

  // Handle machine gun continuous firing start
  socket.on('startMachineGunFiring', () => {
    const player = players.get(socket.id);
    const playerGun = playerGunInventories.get(socket.id);
    
    if (!player || !playerGun || !playerGun.hasGun || playerGun.gunType !== 'machine_gun') {
      socket.emit('error', 'Cannot start machine gun firing - invalid gun or player');
      return;
    }
    
    startMachineGunFiring(socket.id);
  });

  // Handle machine gun continuous firing stop
  socket.on('stopMachineGunFiring', () => {
    stopMachineGunFiring(socket.id);
  });

  // Handle gun list request
  socket.on('getGuns', () => {
    const player = players.get(socket.id);
    if (!player || !player.room) {
      socket.emit('error', 'Player not found or not in room');
      return;
    }
    
    const roomGunMap = roomGuns.get(player.room) || new Map();
    const guns = Array.from(roomGunMap.values());
    socket.emit('gunList', guns);
  });

  // Admin event handlers
  socket.on('requestAdminSettings', () => {
    const player = players.get(socket.id);
    if (!player || !isAdmin(player.userId)) {
      socket.emit('adminError', 'Admin access denied');
      return;
    }
    
    socket.emit('adminSettings', MONSTER_CONFIG);
  });

  socket.on('updateAdminSettings', (newSettings) => {
    const player = players.get(socket.id);
    if (!player || !isAdmin(player.userId)) {
      socket.emit('adminError', 'Admin access denied');
      return;
    }
    
    updateMonsterConfig(newSettings);
    
    // Restart monster spawning for all rooms with new settings
    for (const [roomId, timer] of monsterSpawnTimers) {
      stopMonsterSpawning(roomId);
      startMonsterSpawning(roomId);
    }
    
    socket.emit('adminSettings', MONSTER_CONFIG);
    console.log('Admin settings updated by:', player.name);
  });

  socket.on('adminSpawnMonster', () => {
    console.log('Admin spawn monster request from:', socket.id);
    const player = players.get(socket.id);
    if (!player || !isAdmin(player.userId)) {
      console.log('Admin access denied for:', player?.userId);
      socket.emit('adminError', 'Admin access denied');
      return;
    }
    
    if (!player.room) {
      console.log('Player not in room:', socket.id);
      socket.emit('adminError', 'Not in a room');
      return;
    }
    
    console.log('Admin spawning monster in room:', player.room);
    const monster = adminSpawnMonster(player.room);
    if (monster) {
      socket.emit('adminActionSuccess', { action: 'spawn', monster: monster });
      console.log('Monster spawned successfully:', monster.name);
    } else {
      socket.emit('adminActionError', { action: 'spawn', message: 'Room is full of monsters' });
      console.log('Failed to spawn monster - room full');
    }
  });

  socket.on('adminClearMonsters', () => {
    console.log('Admin clear monsters request from:', socket.id);
    const player = players.get(socket.id);
    if (!player || !isAdmin(player.userId)) {
      console.log('Admin access denied for:', player?.userId);
      socket.emit('adminError', 'Admin access denied');
      return;
    }
    
    if (!player.room) {
      console.log('Player not in room:', socket.id);
      socket.emit('adminError', 'Not in a room');
      return;
    }
    
    console.log('Admin clearing monsters in room:', player.room);
    const count = adminClearMonsters(player.room);
    socket.emit('adminActionSuccess', { action: 'clear', count: count });
    console.log('Cleared', count, 'monsters from room:', player.room);
  });

  socket.on('adminApplySettings', (newSettings) => {
    console.log('=== SERVER ADMIN APPLY SETTINGS DEBUG ===');
    console.log('Received adminApplySettings event from socket:', socket.id);
    
    const player = players.get(socket.id);
    console.log('Player found:', !!player);
    console.log('Player data:', player);
    
    if (!player || !isAdmin(player.userId)) {
      console.log('Admin access denied for player:', player?.userId);
      console.log('Admin users:', ADMIN_USERS);
      socket.emit('adminError', 'Admin access denied');
      return;
    }
    
    if (!player.room) {
      console.log('Player not in room:', socket.id);
      socket.emit('adminError', 'Not in a room');
      return;
    }
    
    console.log('Admin applying settings in room:', player.room);
    console.log('New settings:', newSettings);
    
    // Update the global monster configuration
    console.log('Updating monster config...');
    updateMonsterConfig(newSettings);
    console.log('Monster config updated');
    
    // Clear existing monsters first
    console.log('Clearing existing monsters...');
    const clearedCount = adminClearMonsters(player.room);
    console.log('Cleared', clearedCount, 'monsters');
    
    // Stop current monster spawning with a small delay to ensure it's properly stopped
    console.log('Stopping current monster spawning...');
    stopMonsterSpawning(player.room);
    
    // Wait a bit before starting new spawning to avoid conflicts
    setTimeout(() => {
      console.log('Starting monster spawning with new settings...');
      startMonsterSpawning(player.room);
      console.log('Monster spawning started');
      
      // Spawn initial monsters with new settings after a delay
      const spawnCount = Math.min(newSettings.maxMonstersPerRoom, 3); // Spawn up to 3 monsters initially
      console.log('Spawning', spawnCount, 'initial monsters...');
      
      for (let i = 0; i < spawnCount; i++) {
        setTimeout(() => {
          console.log('Spawning monster', i + 1, 'of', spawnCount);
          spawnMonster(player.room);
        }, (i + 1) * 2000); // Spawn monsters with 2-second intervals, starting after 2 seconds
      }
      
      console.log('Sending success response to client...');
      socket.emit('adminActionSuccess', { 
        action: 'apply', 
        message: 'Settings applied successfully',
        clearedCount,
        spawnCount
      });
      
      console.log(`Admin settings applied by ${player.name} in room ${player.room}: cleared ${clearedCount} monsters, spawning ${spawnCount} new monsters`);
    }, 1000); // Wait 1 second before starting new spawning
  });

  socket.on('requestAdminStats', () => {
    const player = players.get(socket.id);
    if (!player || !isAdmin(player.userId)) {
      socket.emit('adminError', 'Admin access denied');
      return;
    }
    
    if (!player.room) {
      socket.emit('adminError', 'Not in a room');
      return;
    }
    
    const stats = getAdminStats(player.room);
    socket.emit('adminStats', stats);
    console.log('Sent admin stats to player:', player.name, 'Stats:', stats);
  });

  // Clean up when a room becomes empty
  const cleanupEmptyRoom = (roomId) => {
    if (rooms.has(roomId) && rooms.get(roomId).size === 0) {
      console.log('Removing empty room:', roomId);
      rooms.delete(roomId);
      roomBackgrounds.delete(roomId); // Also clean up background settings
      // Stop monster spawning for this room
      stopMonsterSpawning(roomId);
      // Stop monster movement for this room
      stopMonsterMovement(roomId);
      // Stop sword spawning for this room
      stopSwordSpawning(roomId);
      // Stop gun spawning for this room
      stopGunSpawning(roomId);
      // Stop projectile updates for this room
      stopProjectileUpdates(roomId);
      // Clear monsters for this room
      roomMonsters.delete(roomId);
      // Clear swords for this room
      roomSwords.delete(roomId);
      // Clear guns for this room
      roomGuns.delete(roomId);
      // Clear projectiles for this room
      projectiles.delete(roomId);
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
    
    // Clean up this player's data
    delete playerProfiles[socket.id];
    delete playerWallets[socket.id];
    playerStats.delete(socket.id); // Clean up player stats
    
    // Remove from friend requests
    Object.keys(friendRequests).forEach(playerId => {
      friendRequests[playerId] = friendRequests[playerId].filter(
        req => req.senderId !== socket.id
      );
    });
    
    // Remove from friendships
    if (friendships[socket.id]) {
      // Notify all friends about disconnection
      friendships[socket.id].forEach(friendId => {
        if (friendships[friendId]) {
          // Remove this player from their friends list
          friendships[friendId] = friendships[friendId].filter(id => id !== socket.id);
          
          // Notify them if they're online
          if (players.has(friendId)) {
            io.to(friendId).emit('friendDisconnected', { friendId: socket.id });
          }
        }
      });
      
      // Finally delete this player's friendships
      delete friendships[socket.id];
    }
    
    // Clean up machine gun firing state
    stopMachineGunFiring(socket.id);
    
    // Clean up PVP status
    playerPVPStatus.delete(socket.id);
    pvpDamageCooldown.delete(socket.id);
  });

  // PVP System Event Handlers
  
  // Toggle PVP mode
  socket.on('togglePVP', () => {
    console.log('Received togglePVP event from socket:', socket.id);
    
    const player = players.get(socket.id);
    if (!player || !player.room) {
      console.log('Player not found or not in room:', { player: !!player, room: player?.room });
      socket.emit('error', 'Player not in a room');
      return;
    }
    
    const currentPVPStatus = playerPVPStatus.get(socket.id) || { isPVP: false, timestamp: 0 };
    const newPVPStatus = !currentPVPStatus.isPVP;
    
    playerPVPStatus.set(socket.id, {
      isPVP: newPVPStatus,
      timestamp: Date.now()
    });
    
    console.log(`Player ${player.name} (${socket.id}) ${newPVPStatus ? 'enabled' : 'disabled'} PVP mode`);
    
    // Broadcast PVP status change to all players in the room
    io.to(player.room).emit('pvpStatusChanged', {
      playerId: socket.id,
      playerName: player.name,
      isPVP: newPVPStatus
    });
    
    // Send confirmation to the player
    socket.emit('pvpStatusUpdated', {
      isPVP: newPVPStatus,
      message: newPVPStatus ? 'PVP mode enabled! You can now attack other PVP players.' : 'PVP mode disabled. You are safe from PVP attacks.'
    });
  });
  
  // Handle PVP sword attack
  socket.on('pvpSwordAttack', (data) => {
    const attacker = players.get(socket.id);
    const targetId = data.targetId;
    const target = players.get(targetId);
    
    if (!attacker || !target || !attacker.room || attacker.room !== target.room) {
      socket.emit('error', 'Invalid PVP attack');
      return;
    }
    
    // Check if attacker is in PVP mode
    const attackerPVP = playerPVPStatus.get(socket.id);
    if (!attackerPVP || !attackerPVP.isPVP) {
      socket.emit('error', 'You must be in PVP mode to attack other players');
      return;
    }
    
    // Check if target is in PVP mode
    const targetPVP = playerPVPStatus.get(targetId);
    if (!targetPVP || !targetPVP.isPVP) {
      socket.emit('error', 'You can only attack players who are also in PVP mode');
      return;
    }
    
    // Apply damage (client handles range checking)
    const targetStats = playerStats.get(targetId);
    if (!targetStats) {
      socket.emit('error', 'Target has no stats');
      return;
    }
    
    const damage = PVP_CONFIG.swordDamage;
    targetStats.hp = Math.max(0, targetStats.hp - damage);
    
    console.log(`PVP Sword Attack: ${attacker.name} (${socket.id}) attacked ${target.name} (${targetId}) for ${damage} damage`);
    
    // Broadcast the attack to all players in the room
    io.to(attacker.room).emit('pvpAttack', {
      attackerId: socket.id,
      attackerName: attacker.name,
      targetId: targetId,
      targetName: target.name,
      damage: damage,
      weaponType: 'sword',
      targetRemainingHp: targetStats.hp
    });
    
    // Check if target died
    if (targetStats.hp <= 0) {
      console.log(`PVP Kill: ${attacker.name} killed ${target.name}`);
      
      // Don't auto-respawn - let player click to revive
      // targetStats.hp = targetStats.maxHp;
      // target.position = { x: 50, y: 100 }; // Respawn position
      
      io.to(attacker.room).emit('pvpKill', {
        killerId: socket.id,
        killerName: attacker.name,
        victimId: targetId,
        victimName: target.name,
        respawnPosition: target.position
      });
    }
    
    // Update target's stats
    io.to(targetId).emit('playerStatsUpdated', targetStats);
  });
  
  // Handle PVP gun attack
  socket.on('pvpGunAttack', (data) => {
    const attacker = players.get(socket.id);
    const targetId = data.targetId;
    const target = players.get(targetId);
    
    if (!attacker || !target || !attacker.room || attacker.room !== target.room) {
      socket.emit('error', 'Invalid PVP attack');
      return;
    }
    
    // Check if attacker is in PVP mode
    const attackerPVP = playerPVPStatus.get(socket.id);
    if (!attackerPVP || !attackerPVP.isPVP) {
      socket.emit('error', 'You must be in PVP mode to attack other players');
      return;
    }
    
    // Check if target is in PVP mode
    const targetPVP = playerPVPStatus.get(targetId);
    if (!targetPVP || !targetPVP.isPVP) {
      socket.emit('error', 'You can only attack players who are also in PVP mode');
      return;
    }
    
    // Apply damage (client handles range checking)
    const targetStats = playerStats.get(targetId);
    if (!targetStats) {
      socket.emit('error', 'Target has no stats');
      return;
    }
    
    const damage = PVP_CONFIG.gunDamage;
    targetStats.hp = Math.max(0, targetStats.hp - damage);
    
    console.log(`PVP Gun Attack: ${attacker.name} (${socket.id}) shot ${target.name} (${targetId}) for ${damage} damage`);
    
    // Broadcast the attack to all players in the room
    io.to(attacker.room).emit('pvpAttack', {
      attackerId: socket.id,
      attackerName: attacker.name,
      targetId: targetId,
      targetName: target.name,
      damage: damage,
      weaponType: 'gun',
      targetRemainingHp: targetStats.hp
    });
    
    // Check if target died
    if (targetStats.hp <= 0) {
      console.log(`PVP Kill: ${attacker.name} killed ${target.name}`);
      
      // Don't auto-respawn - let player click to revive
      // targetStats.hp = targetStats.maxHp;
      // target.position = { x: 50, y: 100 }; // Respawn position
      
      io.to(attacker.room).emit('pvpKill', {
        killerId: socket.id,
        killerName: attacker.name,
        victimId: targetId,
        victimName: target.name,
        respawnPosition: target.position
      });
    }
    
    // Update target's stats
    io.to(targetId).emit('playerStatsUpdated', targetStats);
  });

  // Handle player revival
  socket.on('playerRevived', () => {
    console.log('Received playerRevived event from socket:', socket.id);
    
    const player = players.get(socket.id);
    if (!player || !player.room) {
      console.log('Player not found or not in room:', { player: !!player, room: player?.room });
      socket.emit('error', 'Player not in a room');
      return;
    }
    
    const playerStat = playerStats.get(socket.id);
    if (playerStat) {
      // Reset HP to full
      playerStat.hp = playerStat.maxHp;
      
      // Respawn player at a safe position
      player.position = { x: 50, y: 100 };
      
      console.log(`Player ${player.name} (${socket.id}) has been revived`);
      
      // Broadcast revival to all players in the room
      io.to(player.room).emit('playerRevived', {
        playerId: socket.id,
        playerName: player.name,
        newPosition: player.position,
        newHp: playerStat.hp
      });
      
      // Update player position for all clients
      io.to(player.room).emit('playerMoved', {
        playerId: socket.id,
        position: player.position
      });
    }
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

  // Update player state when they move
  const updatePlayerState = (playerId, state) => {
    playerStates.set(playerId, { ...playerStates.get(playerId), ...state });
  };
});

// Start the server
const PORT = process.env.PORT || 3001;
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and accessible via all network interfaces`);
  console.log(`Try connecting from other devices using http://<your-ip-address>:${PORT}`);
}); 