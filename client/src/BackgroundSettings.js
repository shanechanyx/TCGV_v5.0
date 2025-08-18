/**
 * Background Settings Configuration
 * 
 * This file contains configuration for the interactive area background.
 * You can modify these settings to change the appearance of the background.
 */

// Available background types
export const BackgroundTypes = {
  SOLID: 'solid',
  GRADIENT: 'gradient',
  PATTERN: 'pattern',
  IMAGE: 'image'
};

// Available solid background colors
export const SolidColors = [
  { name: 'Light Gray', value: '#f5f5f5' },
  { name: 'Dark Gray', value: '#333333' },
  { name: 'Navy Blue', value: '#1a365d' },
  { name: 'Forest Green', value: '#1e3a2f' },
  { name: 'Burgundy', value: '#5d1a1a' },
  { name: 'Black', value: '#111111' }
];

// Available gradient backgrounds
export const Gradients = [
  { 
    name: 'Blue to Purple', 
    value: 'linear-gradient(135deg, #2c5282 0%, #553c9a 100%)' 
  },
  { 
    name: 'Green to Teal', 
    value: 'linear-gradient(135deg, #276749 0%, #285e61 100%)' 
  },
  { 
    name: 'Orange to Red', 
    value: 'linear-gradient(135deg, #c05621 0%, #9b2c2c 100%)'
  },
  { 
    name: 'Dark Theme', 
    value: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)'
  }
];

// Available patterns
export const Patterns = [
  {
    name: 'Grid',
    value: `repeating-linear-gradient(
      to right,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.1) 1px,
      transparent 1px,
      transparent 30px
    ),
    repeating-linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.1) 1px,
      transparent 1px,
      transparent 30px
    )`
  },
  {
    name: 'Dots',
    value: `radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0'
  },
  {
    name: 'Diagonal Lines',
    value: `repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.1) 1px,
      transparent 1px,
      transparent 10px
    )`
  }
];

// Sample image URLs (can be replaced with your own images)
export const BackgroundImages = [
  {
    name: 'Abstract Waves',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1000&auto=format&fit=crop'
  },
  {
    name: 'Geometric Pattern',
    url: 'https://images.unsplash.com/photo-1533122250115-6bb28e9a48c3?q=80&w=1000&auto=format&fit=crop'
  },
  {
    name: 'Dark Texture',
    url: 'https://images.unsplash.com/photo-1553949285-bdcb31ec5cba?q=80&w=1000&auto=format&fit=crop'
  }
];

// Default background configuration
export const defaultBackgroundSettings = {
  type: BackgroundTypes.SOLID,
  value: SolidColors[0].value, // Light Gray by default
  opacity: 1,
  blur: 0
}; 