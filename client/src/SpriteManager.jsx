import React, { useEffect, useState, useRef } from 'react';
import './SpriteManager.css';

// Configuration for sprite animations
const defaultSpriteConfig = {
  // Default sprite sheet dimensions
  frameWidth: 64,
  frameHeight: 64,
  // Animation configurations
  animations: {
    idle: {
      frames: 4,
      frameRate: 8,
      repeat: -1 // Loop indefinitely
    },
    walk: {
      frames: 8,
      frameRate: 12,
      repeat: -1
    }
  },
  // Direction configurations
  directions: {
    down: 0,
    left: 1,
    right: 2,
    up: 3
  },
  // Default sprite sheet - to be replaced with user's choice
  defaultSprite: '/sprites/character1.png' // Updated to use existing sprite
};

// Helper function to convert hex color to CSS filter values
const hexToFilter = (hex) => {
  // Return empty string if no hex color provided
  if (!hex) return '';
  
  // Remove the # if it exists
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Calculate a simple filter combination to simulate the color
  // Adjusted filter values for more noticeable tinting
  const hueRotation = Math.round(getHueRotation(r, g, b));
  const saturation = getSaturation(r, g, b);
  
  console.log(`Applying tint: hex=${hex}, hue=${hueRotation}, saturation=${saturation}`);
  
  return `brightness(0.8) sepia(0.5) saturate(${saturation}) hue-rotate(${hueRotation}deg)`;
};

// Helper to calculate approximate hue rotation based on RGB values
const getHueRotation = (r, g, b) => {
  // Simple hue calculation - can be improved for better color matching
  if (r > g && r > b) return 0;     // Red dominant
  if (g > r && g > b) return 120;   // Green dominant
  if (b > r && b > g) return 240;   // Blue dominant
  
  if (r === g && r > b) return 60;  // Yellow
  if (g === b && g > r) return 180; // Cyan
  if (r === b && r > g) return 300; // Magenta
  
  return 0; // Default
};

// Helper to calculate saturation multiplier
const getSaturation = (r, g, b) => {
  // Calculate color intensity
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  if (max === min) return 1; // Grayscale
  
  // Higher value for more vivid colors
  return 1.5 + (max - min) * 2;
};

const SpriteManager = ({ 
  spriteSheet, 
  animation = 'idle', 
  direction = 'down',
  size = 80,
  config = defaultSpriteConfig,
  tintColor = '' // New prop for color tinting
}) => {
  const [frame, setFrame] = useState(0);
  const [animationInterval, setAnimationInterval] = useState(null);
  const spriteRef = useRef(null);

  // Detect if this is Character1 or Character2 by its frame size
  const isCharacter1 = config.frameWidth === 99;
  const isCharacter2 = config.directions && Object.keys(config.directions).length === 6; // Has 6 directions
  
  // Set up animation interval
  useEffect(() => {
    // Get animation configuration
    const anim = config.animations[animation];
    if (!anim || anim.frames <= 1) return;

    // Clear any existing animation interval
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    
    // Reset frame to 0 when animation or direction changes
    setFrame(0);
    
    // Calculate interval between frames in milliseconds
    const interval = 1000 / anim.frameRate;
    
    // Set up a new animation interval
    const newInterval = setInterval(() => {
      setFrame(currentFrame => (currentFrame + 1) % anim.frames);
    }, interval);
    
    setAnimationInterval(newInterval);
    
    // Cleanup on unmount or when animation/direction changes
    return () => {
      if (newInterval) {
        clearInterval(newInterval);
      }
    };
  }, [animation, direction, config, spriteSheet]);

  // Apply background position changes directly to DOM for better performance
  useEffect(() => {
    if (spriteRef.current) {
      const spriteX = -frame * config.frameWidth;
      const directionIndex = config.directions[direction] || 0;
      const spriteY = -directionIndex * config.frameHeight;
      spriteRef.current.style.backgroundPosition = `${spriteX}px ${spriteY}px`;
    }
  }, [frame, direction, config.frameWidth, config.frameHeight, config.directions]);

  // Calculate sprite position for the style object
  const directionIndex = config.directions[direction] || 0;
  const spriteX = -frame * config.frameWidth;
  const spriteY = -directionIndex * config.frameHeight;

  // Use the provided sprite sheet or fall back to default
  const spriteSheetUrl = spriteSheet || config.defaultSprite;
  
  // Debug sprite loading
  console.log(`[SPRITE] Loading sprite: ${spriteSheetUrl}`);
  
  // Convert the tintColor to CSS filter if provided
  const filterStyle = tintColor ? hexToFilter(tintColor) : '';
  
  // Add error handling for sprite loading
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      console.log(`[SPRITE] Successfully loaded: ${spriteSheetUrl}`);
    };
    img.onerror = (e) => {
      console.error(`[SPRITE] Failed to load: ${spriteSheetUrl}`, e);
    };
    img.src = spriteSheetUrl;
  }, [spriteSheetUrl]);

  // Calculate background size based on sprite type
  let backgroundSize = 'auto';
  if (isCharacter1) {
    backgroundSize = '396px 396px'; // 4×4 grid, 99px per cell
  } else if (isCharacter2) {
    backgroundSize = `${config.frameWidth}px ${config.frameHeight * 6}px`; // 1×6 grid
  }

  return (
    <div 
      className="sprite-container"
      style={{
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      <div 
        ref={spriteRef}
        className="sprite"
        style={{
          backgroundImage: `url(${spriteSheetUrl})`,
          backgroundPosition: `${spriteX}px ${spriteY}px`,
          backgroundSize: backgroundSize,
          width: `${config.frameWidth}px`,
          height: `${config.frameHeight}px`,
          transform: `scale(${size / config.frameWidth})`,
          transformOrigin: 'top left',
          filter: filterStyle
        }}
      />
    </div>
  );
};

export default SpriteManager; 