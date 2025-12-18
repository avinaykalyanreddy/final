let socket;
const peerConnections = new Map(); // userId -> RTCPeerConnection
const localStream = null;

function initializeWebRTC(userNameParam) {
  const userName = userNameParam;
  console.log("Initializing WebRTC for user:", userName);
  
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

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      console.log("Got user media stream");
      localVideo.srcObject = stream;
      window.localStream = stream;
      
      // Join with user name
      socket.emit("join", userName);
      console.log("Sent join event with name:", userName);
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

  socket.on("userJoined", async (data) => {
    await createPeerConnection(data.userId, data.userName);
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
  const remoteVideo = document.createElement("video");
  remoteVideo.id = `video-${userId}`;
  remoteVideo.autoplay = true;
  remoteVideo.playsInline = true;
  videoContainer.appendChild(remoteVideo);

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
