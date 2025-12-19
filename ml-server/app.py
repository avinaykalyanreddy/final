from fastapi import FastAPI, WebSocket
from starlette.websockets import WebSocketDisconnect
import cv2, torch
import numpy as np
import json
from collections import deque
import mediapipe as mp
from utils import decode_image
from model import LSTMModel

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
user_data = {}

window_size = 80
prediction_window = 10


def extract_features(result):
    left = [0.0] * 63
    right = [0.0] * 63

    if result.multi_hand_landmarks:
        for i, hand in enumerate(result.multi_hand_landmarks):
            coords = []
            for lm in hand.landmark:
                coords.extend([lm.x, lm.y, lm.z])
            if i == 0:
                left = coords
            elif i == 1:
                right = coords

    return np.array(left + right, dtype=np.float32)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    userName = None

    try:
        while True:
            data = await ws.receive_text()

            # Parse JSON or fallback
            try:
                message = json.loads(data)

                if message.get("type") == "userName":
                    userName = message.get("userName", "Unknown")
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
                    image_data = data

            except json.JSONDecodeError:
                image_data = data
                userName = userName or "Unknown"

            # Initialize user if missing
            if userName not in user_data:
                user_data[userName] = {
                    "sequence": [],
                    "predictions": deque(maxlen=prediction_window)
                }

            # Remove data URL header
            if isinstance(image_data, str) and image_data.startswith("data:image"):
                image_data = image_data.split(",", 1)[1]

            # Decode frame
            frame = decode_image(image_data)
            frame = cv2.resize(frame, (320, 240))

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = hands.process(rgb)

            features = extract_features(result)

            # Update sequence
            seq = user_data[userName]["sequence"]
            seq.append(features)
            user_data[userName]["sequence"] = seq[-window_size:]

            # Predict when window full
            if len(user_data[userName]["sequence"]) == window_size:
                x = torch.tensor(
                    [user_data[userName]["sequence"]],
                    dtype=torch.float32
                )

                with torch.no_grad():
                    pred = model(x)
                    label = labels[pred.argmax(1).item()]

                user_data[userName]["predictions"].append(label)

                if len(user_data[userName]["predictions"]) >= 3:
                    stable = max(
                        set(user_data[userName]["predictions"]),
                        key=user_data[userName]["predictions"].count
                    )

                    response = json.dumps({
                        "type": "prediction",
                        "userName": userName,
                        "prediction": stable
                    })
                    await ws.send_text(response)

    except WebSocketDisconnect:
        print(f"Client {userName} disconnected")

    except Exception as e:
        print(f"Error processing frame: {e}")
