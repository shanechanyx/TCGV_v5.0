# TCGV v5.0 Asset Organization

## 📁 Asset Directory Structure

```
client/public/assets/
├── characters/          # Character sprites and animations
│   ├── player/         # Player character sprites
│   ├── npc/           # NPC character sprites
│   └── monsters/      # Monster/enemy sprites
├── weapons/           # Weapon sprites and models
│   ├── swords/        # Sword sprites and animations
│   └── guns/          # Gun sprites and animations
├── sounds/            # Audio files
│   ├── effects/       # Sound effects (sword swing, gun shots, etc.)
│   └── music/         # Background music and ambient sounds
└── ui/                # User interface elements
    ├── buttons/       # Button sprites
    ├── icons/         # Icon sprites
    └── backgrounds/   # UI background images
```

## 🎭 Characters

### Current Assets:
- `character1.png` - Main player character sprite
- Located in: `client/public/sprites/`

### Recommended Additions:
- Multiple character sprites with different styles
- Animation frames for walking, idle, attacking
- Character selection thumbnails

## ⚔️ Weapons

### Current Status:
- **Swords:** Rendered as colored rectangles (no sprites)
- **Guns:** Rendered as colored rectangles (no sprites)

### Recommended Assets:
- Sword sprites with different types (Basic, Fire, Ice, etc.)
- Gun sprites for each type (Pistol, Shotgun, Machine Gun)
- Weapon pickup/equip animations

## 🔊 Sound Effects

### Current Status:
- **Voice Chat:** ✅ Working (WebRTC)
- **Sound Effects:** ❌ Not implemented

### Recommended Additions:
- Sword swing sounds
- Gun shot sounds
- Monster death sounds
- Background music
- UI interaction sounds

## 🎨 UI Elements

### Current Status:
- Basic HTML/CSS styling
- No custom UI sprites

### Recommended Additions:
- Custom button sprites
- Health bar graphics
- Inventory icons
- Menu backgrounds

## 📝 Asset Guidelines

### Image Formats:
- **Sprites:** PNG (with transparency)
- **UI Elements:** PNG/SVG
- **Backgrounds:** PNG/JPG

### Audio Formats:
- **Sound Effects:** MP3/WAV/OGG
- **Music:** MP3/OGG

### File Naming:
- Use descriptive names: `basic_sword.png`, `pistol_shot.wav`
- Include size/type: `character1_64x64.png`
- Use underscores, not spaces

### Optimization:
- Compress images for web
- Use appropriate audio bitrates
- Consider lazy loading for large assets
