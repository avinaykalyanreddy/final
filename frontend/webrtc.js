let socket;
const peerConnections = new Map(); // userId -> RTCPeerConnection
const localStream = null;

// Cross-browser helper for getUserMedia
function getUserMediaStream(constraints) {
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyGetUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

  if (legacyGetUserMedia) {
    return new Promise((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  }

  return Promise.reject(new Error("getUserMedia is not supported in this browser/context."));
}

function initializeWebRTC(roomIdParam, userNameParam) {
  const roomId = roomIdParam || "default";
  const userName = userNameParam;
  console.log("Initializing WebRTC for user:", userName, "in room:", roomId);
  
  const localVideo = document.getElementById("localVideo");
  if (!localVideo) {
    console.error("Local video element not found!");
    return;
  }

  socket = io("http://localhost:3000");

  socket.on("connect", () => {
    console.log("Connected to signaling server");
  });

  socket.on("connect_error", (error) => {
    console.error("Failed to connect to signaling server:", error);
    alert("Failed to connect to signaling server. Make sure it's running on port 3000.");
  });

  getUserMediaStream({ video: true, audio: true })
    .then(stream => {
      console.log("Got user media stream");
      localVideo.srcObject = stream;
      window.localStream = stream;
      
      // Join with room + user name
      socket.emit("join", { roomId, userName });
      console.log("Sent join event with name:", userName, "room:", roomId);
    })
    .catch(error => {
      console.error("Error accessing media devices:", error);
      alert("Failed to access camera/microphone. Please allow permissions and refresh.");
    });

  socket.on("ready", async () => {
    console.log("Ready signal received");
    // The server will send existingUsers automatically
  });

  socket.on("existingUsers", async (users) => {
    for (const user of users) {
      await createPeerConnection(user.userId, user.userName);
    }
  });

  // When we first join, server can send existingActions so we see
  // current messages from everyone already in the room.
  socket.on("existingActions", (actions) => {
    if (!actions || !Array.isArray(actions)) return;
    if (typeof window.addActionToBar !== "function") return;

    actions.forEach(({ userName, action }) => {
      if (!userName || !action) return;
      window.addActionToBar(userName, action);
    });
  });

  socket.on("userJoined", async (data) => {
    // A new user joined this room.
    // They will create the offer to us using the existingUsers list,
    // so here we just ensure a peer connection exists (non-initiator).
    if (!peerConnections.has(data.userId)) {
      await createPeerConnection(data.userId, data.userName, false);
    }
  });

  socket.on("userLeft", (data) => {
    const videoElement = document.getElementById(`video-${data.userId}`);
    if (videoElement) {
      videoElement.remove();
    }
    if (peerConnections.has(data.userId)) {
      peerConnections.get(data.userId).close();
      peerConnections.delete(data.userId);
    }
  });

  socket.on("offer", async (data) => {
    const { from, userName: fromUserName, ...offer } = data;
    if (!peerConnections.has(from)) {
      await createPeerConnection(from, fromUserName, false);
    }
    const pc = peerConnections.get(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { ...answer, to: from });
  });

  socket.on("answer", async (data) => {
    const { from, ...answer } = data;
    if (peerConnections.has(from)) {
      const pc = peerConnections.get(from);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on("ice", async (data) => {
    const { from, ...candidate } = data;
    if (peerConnections.has(from)) {
      const pc = peerConnections.get(from);
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  // Receive sign actions from others in the room and show them in Recent Actions
  socket.on("action", (data) => {
    if (!data) return;
    const { userId, userName, action } = data;
    if (typeof window.addActionToBar === "function") {
      // Pass userName; addActionToBar will ensure only one row per user.
      window.addActionToBar(userName, action);
    }
  });

  // Expose socket globally so other scripts (captions.js) can use it
  window.socket = socket;
}

async function createPeerConnection(userId, userName, initiator = true) {
  if (peerConnections.has(userId)) {
    return peerConnections.get(userId);
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Add local tracks
  if (window.localStream) {
    window.localStream.getTracks().forEach(track => {
      pc.addTrack(track, window.localStream);
    });
  }

  // Create remote video element
  const videoContainer = document.getElementById("videoContainer");
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.width = "45%";

  const remoteVideo = document.createElement("video");
  remoteVideo.id = `video-${userId}`;
  remoteVideo.autoplay = true;
  remoteVideo.playsInline = true;
  remoteVideo.style.width = "100%";

  const nameLabel = document.createElement("div");
  nameLabel.innerText = userName || "Participant";
  nameLabel.style.marginTop = "8px";
  nameLabel.style.fontWeight = "bold";
  nameLabel.style.textAlign = "center";

  wrapper.appendChild(remoteVideo);
  wrapper.appendChild(nameLabel);
  videoContainer.appendChild(wrapper);

  pc.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("ice", { ...e.candidate.toJSON(), to: userId });
    }
  };

  peerConnections.set(userId, pc);

  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", { ...offer, to: userId });
  }

  return pc;
}

// Make initializeWebRTC available globally
window.initializeWebRTC = initializeWebRTC;
