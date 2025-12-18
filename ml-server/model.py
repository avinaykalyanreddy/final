import numpy as np
import torch
import torch.nn as nn
import mediapipe as mp

# ==============================
# MODEL
# ==============================
class LSTMModel(nn.Module):
    def __init__(self, input_dim=126, hidden_dim=256, num_classes=10):
        super().__init__()
        self.lstm = nn.LSTM(
            input_dim, hidden_dim, 3,
            batch_first=True, bidirectional=True, dropout=0.3
        )
        self.fc1 = nn.Linear(hidden_dim * 2, hidden_dim)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.4)
        self.fc2 = nn.Linear(hidden_dim, num_classes)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        out = self.fc1(out)
        out = self.relu(out)
        out = self.dropout(out)
        return self.fc2(out)

# ==============================
# MEDIAPIPE HANDS
# ==============================
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ==============================
# FEATURE EXTRACTION
# ==============================
def extract_features(result):
    left = [0.0] * 63
    right = [0.0] * 63

    if result.multi_hand_landmarks:
        for idx, hand_landmarks in enumerate(result.multi_hand_landmarks):
            coords = []
            for lm in hand_landmarks.landmark:
                coords.extend([lm.x, lm.y, lm.z])
            if idx == 0:
                left = coords
            elif idx == 1:
                right = coords

    return np.array(left + right, dtype=np.float32)
