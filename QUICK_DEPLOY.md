# Quick Deployment Guide

## 🚀 Easiest Way: Railway (Recommended)

### Step 1: Deploy Signaling Server

1. Go to https://railway.app and sign up/login
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will detect `signaling-server` folder
5. Add environment variable: `PORT=3000`
6. Click **"Deploy"**
7. Copy the generated URL (e.g., `https://signaling-server-production.up.railway.app`)

### Step 2: Deploy ML Server

1. In Railway, click **"New"** → **"Deploy from GitHub repo"**
2. Select the same repository
3. Select `ml-server` folder
4. Add environment variables:
   - `PORT=8000`
   - `HOST=0.0.0.0`
5. Click **"Deploy"**
6. Copy the generated URL (e.g., `https://ml-server-production.up.railway.app`)

### Step 3: Deploy Frontend

**Option A: Netlify (Easiest)**

1. Go to https://netlify.com and sign up
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect GitHub and select your repo
4. Set:
   - **Base directory**: `frontend`
   - **Build command**: (leave empty)
   - **Publish directory**: `frontend`
5. Before deploying, update `frontend/config.js`:
   ```javascript
   SIGNALING_SERVER: 'https://your-signaling-server.railway.app',
   ML_SERVER_WS: 'wss://your-ml-server.railway.app/ws'
   ```
   (Replace with your actual Railway URLs)
6. Click **"Deploy site"**
7. Copy the Netlify URL (e.g., `https://your-app.netlify.app`)

**Option B: Vercel**

1. Go to https://vercel.com and sign up
2. Click **"Add New Project"**
3. Import your GitHub repo
4. Set **Root Directory** to `frontend`
5. Update `frontend/config.js` with Railway URLs
6. Click **"Deploy"**

### Step 4: Update CORS (Important!)

In Railway, for your **signaling server**, add environment variable:
```
CORS_ORIGIN=https://your-frontend-url.netlify.app
```

Then update `signaling-server/server.js`:
```javascript
const io = new Server(server, { 
  cors: { 
    origin: process.env.CORS_ORIGIN || "*" 
  } 
});
```

---

## 🐳 Alternative: Docker (All-in-One)

If you have a VPS (DigitalOcean, Hetzner, etc.):

```bash
# Clone your repo
git clone <your-repo-url>
cd final-year-project

# Update frontend/config.js with your domain/IP

# Run with Docker Compose
docker-compose up -d

# Your app will be available at http://your-server-ip
```

---

## 📝 Checklist Before Deploying

- [ ] Update `frontend/config.js` with production URLs
- [ ] Update CORS origin in `signaling-server/server.js`
- [ ] Test locally with production URLs
- [ ] Ensure ML model file (`sign_sentence_model.pth`) is in `ml-server/`
- [ ] Check that all dependencies are in `requirements.txt` and `package.json`

---

## 🔒 Security Notes

1. **Change CORS**: Don't use `"*"` in production - set your frontend domain
2. **Use HTTPS**: Railway/Netlify provide SSL automatically
3. **Environment Variables**: Never commit API keys or secrets

---

## 🆘 Troubleshooting

**"Cannot connect to signaling server"**
- Check Railway URL is correct in `config.js`
- Verify CORS settings
- Check Railway logs

**"WebSocket connection failed"**
- Use `wss://` (not `ws://`) for HTTPS sites
- Check ML server is running
- Verify port 8000 is exposed

**"Camera not working"**
- Must use HTTPS (or localhost) for getUserMedia
- Check browser permissions

---

## 💰 Cost Estimate

- **Railway**: Free tier (500 hours/month) or $5/month
- **Netlify/Vercel**: Free tier (100GB bandwidth)
- **Total**: **FREE** for testing, ~$5-10/month for production

---

Need help? Check `DEPLOYMENT.md` for detailed instructions.

