# TCGV Game Deployment Guide

## 🚀 Quick Deploy to GoDaddy

### Prerequisites
- GoDaddy hosting account with Node.js support
- Domain name configured
- FTP/SFTP access or cPanel File Manager

### Step 1: Prepare Your Files

1. **Build the client** (already done):
   ```bash
   cd client
   npm run build
   ```

2. **Your deployment folder structure should be**:
   ```
   TCGV_v5.0/
   ├── server/
   │   ├── server.js
   │   ├── package.json
   │   └── node_modules/ (will be installed on server)
   └── client/
       └── dist/
           ├── bundle.js
           ├── index.html
           └── bundle.js.LICENSE.txt
   ```

### Step 2: Upload to GoDaddy

#### Option A: Using cPanel File Manager
1. Log into your GoDaddy cPanel
2. Open File Manager
3. Navigate to your domain's root directory (usually `public_html`)
4. Upload the entire `server` folder
5. Upload the `client/dist` contents to a subfolder (optional)

#### Option B: Using FTP/SFTP
1. Use FileZilla or similar FTP client
2. Connect to your GoDaddy hosting
3. Upload the `server` folder to your domain root
4. Upload `client/dist` contents to a subfolder (optional)

### Step 3: Install Dependencies

1. **Via cPanel Terminal** (if available):
   ```bash
   cd /path/to/your/server
   npm install --production
   ```

2. **Via SSH** (if you have SSH access):
   ```bash
   ssh your-username@your-domain.com
   cd /path/to/your/server
   npm install --production
   ```

### Step 4: Start the Application

#### Option A: Using cPanel Application Manager
1. In cPanel, find "Application Manager" or "Node.js"
2. Create a new Node.js application
3. Set the startup file to `server.js`
4. Set the application URL to your domain
5. Start the application

#### Option B: Using PM2 (Recommended)
1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start your application:
   ```bash
   cd /path/to/your/server
   pm2 start server.js --name "tcgv-game"
   pm2 save
   pm2 startup
   ```

#### Option C: Using Forever
1. Install Forever:
   ```bash
   npm install -g forever
   ```

2. Start your application:
   ```bash
   cd /path/to/your/server
   forever start server.js
   ```

### Step 5: Configure Domain

1. **Point your domain** to the server directory
2. **Set up a subdomain** (optional) like `game.yourdomain.com`
3. **Configure SSL** for HTTPS (recommended)

### Step 6: Test Your Deployment

1. Visit your domain in a browser
2. Test the game functionality
3. Check that Socket.IO connections work
4. Verify that multiple players can join

## 🔧 Alternative Hosting Options

### Heroku
```bash
# Create Procfile
echo "web: node server/server.js" > Procfile

# Deploy
heroku create your-app-name
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### DigitalOcean App Platform
1. Connect your GitHub repository
2. Set build command: `cd client && npm install && npm run build`
3. Set run command: `cd server && npm install && npm start`
4. Deploy

## 🛠️ Troubleshooting

### Common Issues

1. **Port Issues**: Make sure your hosting provider allows the port you're using (default: 3001)
2. **CORS Issues**: The server is configured to allow all origins in production
3. **Socket.IO Issues**: Ensure WebSocket connections are allowed
4. **File Permissions**: Make sure Node.js can read/write files

### Performance Optimization

1. **Enable Gzip compression** in your hosting settings
2. **Use a CDN** for static assets
3. **Enable caching** for static files
4. **Monitor memory usage** and scale if needed

### Security Considerations

1. **Use HTTPS** for production
2. **Set up environment variables** for sensitive data
3. **Regular backups** of player data
4. **Monitor for abuse** and implement rate limiting if needed

## 📊 Monitoring

### Basic Monitoring
```bash
# Check if app is running
pm2 status

# View logs
pm2 logs tcgv-game

# Monitor resources
pm2 monit
```

### Advanced Monitoring
Consider using services like:
- **UptimeRobot** for uptime monitoring
- **LogRocket** for error tracking
- **New Relic** for performance monitoring

## 🎮 Game Features

Your TCGV game includes:
- ✅ Real-time multiplayer gameplay
- ✅ Monster spawning and combat
- ✅ Sword and gun systems
- ✅ Voice chat capabilities
- ✅ Player progression system
- ✅ Admin panel for game management

## 📞 Support

If you encounter issues:
1. Check the server logs
2. Verify all dependencies are installed
3. Ensure your hosting provider supports Node.js and WebSockets
4. Test with a simple Socket.IO connection first

---

**Happy Gaming! 🎮** 