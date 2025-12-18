let video, canvas, ctx, captions, ws;
let userName = ''; // Will be set when initializeCaptions is called
let lastPrediction = '';
let predictionCount = 0;
const PREDICTION_THRESHOLD = 3; // Number of consistent predictions before showing

function initializeCaptions(userNameParam) {
  userName = userNameParam;
  console.log("Initializing captions for user:", userName);
  
  video = document.getElementById("localVideo");
  canvas = document.getElementById("canvas");
  captions = document.getElementById("captions");
  
  if (!video || !canvas || !captions) {
    console.error("Required elements not found:", { video: !!video, canvas: !!canvas, captions: !!captions });
    return;
  }
  
  ctx = canvas.getContext("2d");
  
  ws = new WebSocket("ws://localhost:8000/ws");

  ws.onopen = () => {
    console.log("WebSocket connected to ML server");
    // Send user name when connection opens
    ws.send(JSON.stringify({ type: 'userName', userName: userName }));
  };
  
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    captions.innerText = "Error: ML server not connected. Make sure it's running on port 8000.";
  };

  ws.onmessage = e => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'prediction') {
        handlePrediction(data.userName, data.prediction);
      } else {
        // Fallback for old format
        handlePrediction(userName, e.data);
      }
    } catch (err) {
      // Fallback for old format (plain text)
      handlePrediction(userName, e.data);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket closed");
    captions.innerText = "ML server disconnected. Please refresh the page.";
  };

  // Wait for video to be ready before starting frame capture
  const startFrameCapture = () => {
    if (!video || !video.videoWidth || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const img = canvas.toDataURL("image/jpeg", 0.6);
    // Send image with user name
    ws.send(JSON.stringify({ 
      type: 'frame', 
      image: img, 
      userName: userName 
    }));
  };

  // Check if video is ready, if not wait for loadedmetadata event
  if (video.videoWidth > 0) {
    setInterval(startFrameCapture, 250);
  } else {
    video.addEventListener('loadedmetadata', () => {
      console.log("Video metadata loaded, starting frame capture");
      setInterval(startFrameCapture, 250);
    });
  }
}

function handlePrediction(userName, prediction) {
  if (prediction === lastPrediction) {
    predictionCount++;
  } else {
    lastPrediction = prediction;
    predictionCount = 1;
  }

  // Only show if prediction is stable
  if (predictionCount >= PREDICTION_THRESHOLD && prediction && prediction.trim() !== '') {
    captions.innerText = `${userName}: ${prediction}`;
    addActionToBar(userName, prediction);
    predictionCount = 0; // Reset after showing
  }
}

function addActionToBar(userName, action) {
  const actionList = document.getElementById("actionList");
  if (!actionList) return;

  const actionItem = document.createElement("div");
  actionItem.className = "action-item";
  
  const timestamp = new Date().toLocaleTimeString();
  
  actionItem.innerHTML = `
    <div class="user-name">${userName}</div>
    <div class="action-text">${action}</div>
    <div class="timestamp">${timestamp}</div>
  `;

  // Add to the top of the list
  actionList.insertBefore(actionItem, actionList.firstChild);

  // Limit to 50 items to prevent memory issues
  while (actionList.children.length > 50) {
    actionList.removeChild(actionList.lastChild);
  }

  // Scroll to top
  actionList.scrollTop = 0;
}

// Make initializeCaptions available globally
window.initializeCaptions = initializeCaptions;
