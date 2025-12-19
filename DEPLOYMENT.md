# Deployment Guide for Zoom Sign App

This guide covers deploying your 3-component application to the internet.

## Architecture Overview

1. **Frontend** (Static HTML/CSS/JS) - Needs static hosting
2. **Signaling Server** (Node.js/Socket.io) - Needs Node.js hosting
3. **ML Server** (Python/FastAPI) - Needs Python hosting

---

## Option 1: Free Deployment (Recommended for Testing)

### Frontend → Netlify/Vercel (Free)

1. **Netlify**:
   ```bash
   cd frontend
   # Create netlify.toml (already created)
   # Push to GitHub, connect to Netlify, deploy
   ```

2. **Vercel**:
   ```bash
   cd frontend
   npm install -g vercel
   vercel
   ```

### Signaling Server → Railway/Render (Free tier)

**Railway**:
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select your repo, choose `signaling-server` folder
4. Add environment variable: `PORT=3000`
5. Deploy

**Render**:
1. Go to https://render.com
2. New Web Service → Connect GitHub
3. Select `signaling-server`
4. Build: `npm install`
5. Start: `node server.js`
6. Environment: `PORT=3000`

### ML Server → Railway/Render (Free tier)

**Railway**:
1. New Service → Deploy from GitHub
2. Select `ml-server` folder
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn app:app --host 0.0.0.0 --port 8000`
5. Environment: `PORT=8000`

**Render**:
1. New Web Service → Python
2. Select `ml-server`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn app:app --host 0.0.0.0 --port 8000`

---

## Option 2: All-in-One Deployment (VPS)

### Using DigitalOcean/Railway/Hetzner

1. **Get a VPS** (Ubuntu 22.04)
2. **Install dependencies**:
   ```bash
   sudo apt update
   sudo apt install nodejs npm python3 python3-pip nginx
   ```

3. **Clone your repo**:
   ```bash
   git clone <your-repo-url>
   cd final-year-project
   ```

4. **Setup Signaling Server**:
   ```bash
   cd signaling-server
   npm install
   npm install -g pm2
   pm2 start server.js --name signaling
   pm2 save
   ```

5. **Setup ML Server**:
   ```bash
   cd ml-server
   pip3 install -r requirements.txt
   pm2 start "uvicorn app:app --host 0.0.0.0 --port 8000" --name ml-server
   pm2 save
   ```

6. **Setup Nginx** (reverse proxy):
   ```bash
   sudo nano /etc/nginx/sites-available/zoom-sign
   ```
   Paste the nginx config (see below), then:
   ```bash
   sudo ln -s /etc/nginx/sites-available/zoom-sign /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. **Setup Frontend**:
   ```bash
   cd frontend
   # Update URLs in index.html to your domain
   sudo cp -r * /var/www/html/
   ```

---

## Option 3: Docker Deployment (Advanced)

See `docker-compose.yml` for containerized deployment.

---

## Important: Update URLs

Before deploying, update these files:

1. **frontend/index.html** - Change `localhost:3000` and `localhost:8000` to your deployed URLs
2. **frontend/webrtc.js** - Update Socket.io URL
3. **frontend/captions.js** - Update WebSocket URL

Or use environment variables (see updated code).

---

## Environment Variables

### Signaling Server
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed origins (default: "*")

### ML Server
- `PORT` - Server port (default: 8000)
- `HOST` - Host address (default: 0.0.0.0)

---

## Quick Start (Railway - Easiest)

1. **Frontend**: Deploy to Netlify/Vercel
2. **Signaling**: Railway → New → GitHub → `signaling-server`
3. **ML Server**: Railway → New → GitHub → `ml-server`
4. Update frontend URLs to Railway URLs
5. Done!

---

## Security Notes

- Change CORS origin from "*" to your frontend domain in production
- Use HTTPS (most hosts provide SSL automatically)
- Consider adding authentication for rooms
- Rate limit WebSocket connections

