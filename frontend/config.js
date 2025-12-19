// Configuration for deployment
// Update these URLs when deploying to production

const CONFIG = {
  // Signaling server URL (Socket.io)
  SIGNALING_SERVER: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://your-signaling-server.railway.app', // Replace with your deployed URL
  
  // ML server WebSocket URL
  ML_SERVER_WS: window.location.hostname === 'localhost'
    ? 'ws://localhost:8000/ws'
    : 'wss://your-ml-server.railway.app/ws' // Replace with your deployed URL (use wss:// for HTTPS)
};

// Make config available globally
window.CONFIG = CONFIG;

