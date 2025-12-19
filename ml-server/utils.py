import numpy as np
import base64
import cv2

def decode_image(data):
    # Handle both data URL format and plain base64
    if "," in data:
      header, encoded = data.split(",", 1)
    else:
        encoded = data
    img_bytes = base64.b64decode(encoded)
    img_array = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(img_array, cv2.IMREAD_COLOR)
