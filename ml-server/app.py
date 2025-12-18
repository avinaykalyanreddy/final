from fastapi import FastAPI, WebSocket
import cv2, torch
import numpy as np
import json
from collections import deque
import mediapipe as mp
from utils import decode_image
from model import LSTMModel   # if model is separate

app = FastAPI()

# Load model
checkpoint = torch.load("sign_sentence_model.pth", map_location="cpu")
labels = checkpoint["labels"]

model = LSTMModel(num_classes=len(labels))
model.load_state_dict(checkpoint["model"])
model.eval()

mp_hands = mp.solutions.hands
hands = mp_hands.Hands()

# Store sequences and predictions per user
user_data = {}  # userName -> {sequence, predictions}

window_size = 80
prediction_window = 10

def extract_features(result):
    left = [0.0]*63
    right = [0.0]*63
    if result.multi_hand_landmarks:
        for i, hand in enumerate(result.multi_hand_landmarks):
            coords = []
            for lm in hand.landmark:
                coords.extend([lm.x, lm.y, lm.z])
            if i == 0: left = coords
            if i == 1: right = coords
    return np.array(left + right, dtype=np.float32)

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    userName = None

    while True:
        try:
            data = await ws.receive_text()
            
            # Try to parse as JSON
            try:
                message = json.loads(data)
                if message.get("type") == "userName":
                    userName = message.get("userName", "Unknown")
                    # Initialize user data
                    if userName not in user_data:
                        user_data[userName] = {
                            "sequence": [],
                            "predictions": deque(maxlen=prediction_window)
                        }
                    continue
                elif message.get("type") == "frame":
                    image_data = message.get("image", "")
                    userName = message.get("userName", userName or "Unknown")
                else:
                    # Fallback: treat as image data
                    image_data = data
            except json.JSONDecodeError:
                # Old format: plain image data
                image_data = data
                if not userName:
                    userName = "Unknown"
            
            # Initialize user data if not exists
            if userName not in user_data:
                user_data[userName] = {
                    "sequence": [],
                    "predictions": deque(maxlen=prediction_window)
                }
            
            # Extract image from data URL if needed
            if isinstance(image_data, str) and image_data.startswith("data:image"):
                # Extract base64 part
                if "," in image_data:
                    image_data = image_data.split(",", 1)[1]
            
            frame = decode_image(image_data if isinstance(image_data, str) else data)
            frame = cv2.resize(frame, (320, 240))

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hands.process(rgb)

            features = extract_features(result)
            user_data[userName]["sequence"].append(features)
            user_data[userName]["sequence"][:] = user_data[userName]["sequence"][-window_size:]

            if len(user_data[userName]["sequence"]) == window_size:
                x = torch.tensor([user_data[userName]["sequence"]], dtype=torch.float32)
                with torch.no_grad():
                    pred = model(x)
                    label = labels[pred.argmax(1).item()]

                user_data[userName]["predictions"].append(label)
                
                if len(user_data[userName]["predictions"]) >= 3:
                    stable = max(set(user_data[userName]["predictions"]), key=user_data[userName]["predictions"].count)
                    
                    # Send prediction with user name
                    response = json.dumps({
                        "type": "prediction",
                        "userName": userName,
                        "prediction": stable
                    })
                    await ws.send_text(response)
        except Exception as e:
            print(f"Error processing frame: {e}")
            continue
