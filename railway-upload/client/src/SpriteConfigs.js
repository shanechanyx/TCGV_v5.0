// This file contains configuration presets for different sprite types

// Standard 4-direction RPG character with 4 frames per animation
export const RPG_CHARACTER_CONFIG = {
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    idle: {
      frames: 4,
      frameRate: 8,
      repeat: -1
    },
    walk: {
      frames: 8,
      frameRate: 12,
      repeat: -1
    }
  },
  directions: {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  },
  defaultSprite: '/sprites/character1.png'
};

// 8-bit style character with simple animations
export const RETRO_8BIT_CONFIG = {
  frameWidth: 32,
  frameHeight: 32,
  animations: {
    idle: {
      frames: 2,
      frameRate: 4,
      repeat: -1
    },
    walk: {
      frames: 4,
      frameRate: 8,
      repeat: -1
    }
  },
  directions: {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  },
  defaultSprite: '/sprites/character1.png'
};

// 16-bit style character with more detailed animations
export const RETRO_16BIT_CONFIG = {
  frameWidth: 48,
  frameHeight: 48,
  animations: {
    idle: {
      frames: 4,
      frameRate: 8,
      repeat: -1
    },
    walk: {
      frames: 6,
      frameRate: 10,
      repeat: -1
    }
  },
  directions: {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  },
  defaultSprite: '/sprites/character1.png'
};

// New Character 1 configuration - updated for proper frame-by-frame animation
export const CHARACTER1_CONFIG = {
  frameWidth: 99,  // Width of a single frame (1/4 of total width)
  frameHeight: 99, // Height of a single frame (1/4 of total height)
  animations: {
    idle: {
      frames: 4,   // Use first 4 frames (across) for idle animation
      frameRate: 8, // 8 frames per second
      repeat: -1    // Loop indefinitely
    },
    walk: {
      frames: 4,    // Use first 4 frames (across) for walking animation
      frameRate: 10, // Slightly faster for walking
      repeat: -1
    }
  },
  directions: {
    down: 0,  // Top row = down direction
    left: 1,  // Second row = left direction
    right: 2, // Third row = right direction
    up: 3     // Bottom row = up direction
  },
  defaultSprite: '/sprites/character1.png'
};

// Character 2 configuration for 1×6 sprite layout
export const CHARACTER2_CONFIG = {
  frameWidth: 64,   // Width of a single frame 
  frameHeight: 64,  // Height of a single frame
  animations: {
    idle: {
      frames: 1,    // Only one frame per row
      frameRate: 4,
      repeat: -1
    },
    walk: {
      frames: 1,    // Only one frame per row
      frameRate: 8,
      repeat: -1
    }
  },
  directions: {
    down: 0,  // First row = down direction
    left: 1,  // Second row = left direction
    right: 2, // Third row = right direction
    up: 3,    // Fourth row = up direction
    special1: 4, // Fifth row = special animation 1
    special2: 5  // Sixth row = special animation 2
  },
  defaultSprite: '/sprites/character1.png'
};

// List of available character types for selection UI
export const AVAILABLE_SPRITE_TYPES = [
  {
    id: 'pixelBoi',
    name: 'PixelBoi',
    config: RETRO_8BIT_CONFIG,
    thumbnail: '/sprites/thumbnails/8bit.png'
  },
  {
    id: 'pixelGal',
    name: 'PixelGal',
    config: RETRO_16BIT_CONFIG,
    thumbnail: '/sprites/thumbnails/16bit.png'
  },
  {
    id: 'pixelMan',
    name: 'PixelMan',
    config: CHARACTER1_CONFIG,
    thumbnail: '/sprites/thumbnails/character1.png'
  },
  {
    id: 'pixelWomen',
    name: 'PixelWomen',
    config: CHARACTER2_CONFIG,
    thumbnail: '/sprites/thumbnails/character2.png'
  }
];

// Function to get config by ID
export function getSpriteConfigById(id) {
  const spriteType = AVAILABLE_SPRITE_TYPES.find(type => type.id === id);
  return spriteType ? spriteType.config : RPG_CHARACTER_CONFIG;
} 