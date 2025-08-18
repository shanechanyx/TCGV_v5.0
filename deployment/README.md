# 🎮 TCGV Game - Quick Deploy Guide

## 📦 What's Included

This deployment package contains everything needed to run your TCGV multiplayer game:

- **Server**: Node.js Express + Socket.IO server
- **Client**: Built React application (minified and optimized)
- **Configuration**: Production-ready settings

## 🚀 Quick Start (GoDaddy)

### 1. Upload Files
1. Upload the `server` folder to your GoDaddy hosting
2. Place it in your domain's root directory or a subdirectory

### 2. Install Dependencies
```bash
cd server
npm install --production
```

### 3. Start the Game
```bash
npm start
```

### 4. Access Your Game
Visit your domain in a browser!

## 🔧 Alternative: Using PM2 (Recommended)

For better reliability, use PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start your game
cd server
pm2 start server.js --name "tcgv-game"

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🎯 Game Features

Your TCGV game includes:
- ✅ Real-time multiplayer gameplay
- ✅ Monster spawning and combat
- ✅ Sword and gun systems (Pistol, Shotgun, Machine Gun)
- ✅ Voice chat capabilities
- ✅ Player progression system
- ✅ Admin panel for game management

## 🎮 How to Play

1. **Join a Room**: Enter a room number and your username
2. **Move**: Use arrow keys to move around
3. **Attack**: Press F to attack monsters with swords
4. **Shoot**: Press G to shoot guns
5. **Pickup Items**: Walk near swords/guns and press Spacebar
6. **Voice Chat**: Use the voice chat feature to communicate

## 🛠️ Troubleshooting

### Common Issues:
- **Port 3001 blocked**: Contact your hosting provider
- **WebSocket issues**: Ensure your hosting supports WebSockets
- **Performance**: Consider upgrading your hosting plan

### Need Help?
- Check the server logs
- Verify all dependencies are installed
- Test with a simple Socket.IO connection first

## 📞 Support

For detailed deployment instructions, see `DEPLOYMENT.md` in the main project directory.

---

**Happy Gaming! 🎮** 