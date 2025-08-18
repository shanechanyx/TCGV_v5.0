# 🚀 Deploy TCGV Game to One1.Earth via Railway

## **Step 1: Create Railway Account**

1. **Go to [Railway.app](https://railway.app)**
2. **Click "Start a New Project"**
3. **Sign up with GitHub** (recommended) or email
4. **Verify your account**

## **Step 2: Deploy Your Game**

### **Option A: Deploy from GitHub (Recommended)**

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/TCGV_v5.0.git
   git push -u origin main
   ```

2. **In Railway:**
   - Click "Deploy from GitHub repo"
   - Select your TCGV_v5.0 repository
   - Railway will automatically detect and deploy

### **Option B: Deploy from Local Files**

1. **In Railway dashboard:**
   - Click "Deploy from GitHub repo"
   - Choose "Deploy from local files"
   - Upload your project folder

## **Step 3: Configure Your Domain**

1. **In Railway project:**
   - Go to "Settings" tab
   - Click "Domains"
   - Add custom domain: `One1.Earth`

2. **Update DNS in GoDaddy:**
   - Log into GoDaddy
   - Go to DNS management for One1.Earth
   - Add CNAME record:
     - **Name:** `@` (or leave blank)
     - **Value:** `your-railway-app.railway.app`
     - **TTL:** 600

## **Step 4: Test Your Game**

1. **Wait 5-10 minutes** for DNS propagation
2. **Visit One1.Earth** in your browser
3. **Test the game functionality**
4. **Invite friends to play!**

## **Step 5: Monitor Your App**

- **Railway Dashboard:** Monitor usage and logs
- **Free Tier Limits:** 500 hours/month
- **Scaling:** Upgrade if needed

## **🎮 Your Game Features**

- ✅ Real-time multiplayer gameplay
- ✅ Monster spawning and combat
- ✅ Sword and gun systems
- ✅ Voice chat capabilities
- ✅ Player progression system
- ✅ Admin panel

## **🔧 Troubleshooting**

### **Common Issues:**

1. **Build fails:**
   - Check Railway logs
   - Ensure all dependencies are in package.json

2. **Domain not working:**
   - Wait for DNS propagation (up to 24 hours)
   - Check DNS settings in GoDaddy

3. **Game not loading:**
   - Check Railway logs
   - Verify Socket.IO connections

### **Need Help?**

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Check logs** in Railway dashboard

---

## **🎉 Success!**

Your TCGV game will be live at **One1.Earth** and ready for your friends to play!

**Happy Gaming! 🎮✨** 