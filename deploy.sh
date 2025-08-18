#!/bin/bash

# TCGV Game Deployment Script
# This script prepares your game for deployment

echo "🎮 TCGV Game Deployment Script"
echo "================================"

# Check if we're in the right directory
if [ ! -f "client/package.json" ] || [ ! -f "server/package.json" ]; then
    echo "❌ Error: Please run this script from the TCGV_v5.0 root directory"
    exit 1
fi

# Step 1: Build the client
echo "📦 Building client..."
cd client
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Client build failed"
    exit 1
fi
cd ..

# Step 2: Create deployment directory
echo "📁 Creating deployment directory..."
rm -rf deployment
mkdir -p deployment/server
mkdir -p deployment/client

# Step 3: Copy server files
echo "📋 Copying server files..."
cp -r server/* deployment/server/
rm -rf deployment/server/node_modules 2>/dev/null

# Step 4: Copy built client files
echo "📋 Copying built client files..."
cp -r client/dist/* deployment/client/

# Step 5: Create deployment info
echo "📝 Creating deployment info..."
cat > deployment/DEPLOYMENT_INFO.txt << EOF
TCGV Game Deployment Package
============================

Created: $(date)
Version: 5.0

Deployment Instructions:
1. Upload the 'server' folder to your hosting provider
2. Run 'npm install --production' in the server directory
3. Start the server with 'npm start' or 'pm2 start server.js'

Files included:
- Server: Node.js Express + Socket.IO server
- Client: Built React application (minified)

Game Features:
- Real-time multiplayer gameplay
- Monster spawning and combat
- Sword and gun systems
- Voice chat capabilities
- Player progression system
- Admin panel

Requirements:
- Node.js 14+ 
- npm
- WebSocket support
- Port 3001 (or configure in server.js)

For detailed instructions, see DEPLOYMENT.md
EOF

# Step 6: Create a simple start script
cat > deployment/start.sh << 'EOF'
#!/bin/bash
echo "Starting TCGV Game Server..."
cd server
npm install --production
npm start
EOF

chmod +x deployment/start.sh

# Step 7: Show deployment summary
echo ""
echo "✅ Deployment package created successfully!"
echo ""
echo "📁 Deployment directory: ./deployment/"
echo "📋 Server files: ./deployment/server/"
echo "🌐 Client files: ./deployment/client/"
echo ""
echo "🚀 Next steps:"
echo "1. Upload the 'deployment/server' folder to your hosting provider"
echo "2. Run 'npm install --production' in the server directory"
echo "3. Start the server with 'npm start'"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "🎮 Happy Gaming!" 