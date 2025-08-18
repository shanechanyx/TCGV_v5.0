# Sprite Guide

This directory contains sprite sheets for character animations.

## How to add your own sprites

1. Find or create a sprite sheet with the following structure:
   - Each row represents a direction (down, left, right, up)
   - Each column represents a frame of animation
   - Consistent frame sizes (32x32, 48x48, 64x64, etc.)

2. Place your sprite sheet files in this directory.

3. Update the sprite configuration in `src/SpriteConfigs.js` if your sprites have different dimensions or animation frames.

## Directory Structure

```
sprites/
├── character-default.png  # Default RPG character sprite sheet
├── 8bit-default.png       # Default 8-bit style character
├── 16bit-default.png      # Default 16-bit style character
└── thumbnails/            # Thumbnail images for the character selector
    ├── rpg.png
    ├── 8bit.png
    └── 16bit.png
```

## Sprite Sheet Format

Each sprite sheet should follow this format:

```
┌─────┬─────┬─────┬─────┐
│ D1  │ D2  │ D3  │ D4  │  Down-facing animations
├─────┼─────┼─────┼─────┤
│ L1  │ L2  │ L3  │ L4  │  Left-facing animations
├─────┼─────┼─────┼─────┤
│ R1  │ R2  │ R3  │ R4  │  Right-facing animations
├─────┼─────┼─────┼─────┤
│ U1  │ U2  │ U3  │ U4  │  Up-facing animations
└─────┴─────┴─────┴─────┘
```

Where:
- D1, D2, etc. are frames of the down-facing animation
- L1, L2, etc. are frames of the left-facing animation
- R1, R2, etc. are frames of the right-facing animation
- U1, U2, etc. are frames of the up-facing animation

You can find free sprite sheets online at these resources:
- https://opengameart.org/
- https://itch.io/game-assets/free/tag-sprites
- https://craftpix.net/freebies/ 