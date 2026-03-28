import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import sys
import json
import cv2
import numpy as np
from tensorflow.keras.models import load_model

try:
    # ================= BASE PATH =================
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    # 👉 CHANGE THIS IF MODELS IN FOLDER
    MODEL_DIR = BASE_DIR   # OR: os.path.join(BASE_DIR, "models")

    print("MODEL DIR:", MODEL_DIR)  # DEBUG

    # ================= LOAD MODELS =================
    binary_models = []
    multi_models = []

    for i in range(1, 6):
        bin_path = os.path.join(MODEL_DIR, f"binary_model_fold_{i}.h5")
        mul_path = os.path.join(MODEL_DIR, f"multi_model_fold_{i}.h5")

        print("Loading:", bin_path)
        print("Loading:", mul_path)

        binary_models.append(load_model(bin_path))
        multi_models.append(load_model(mul_path))

    multi_labels = ["satisfactory", "poor", "very_poor"]

    # ================= IMAGE =================
    image_path = sys.argv[1]
    img = cv2.imread(image_path)

    if img is None:
        print(json.dumps({"error": "Invalid image"}))
        sys.exit(0)

    img = cv2.resize(img, (128, 128)) / 255.0
    img = np.expand_dims(img, axis=0)

    # ================= BINARY =================
    preds_bin = [m.predict(img, verbose=0)[0][0] for m in binary_models]
    avg_bin = float(np.mean(preds_bin))

    if avg_bin < 0.5:
        label = "good"
        confidence = (1 - avg_bin)

    else:
        preds_multi = [m.predict(img, verbose=0)[0] for m in multi_models]
        avg_multi = np.mean(preds_multi, axis=0)

        if np.sum(avg_multi) > 0:
            avg_multi = avg_multi / np.sum(avg_multi)

        idx = int(np.argmax(avg_multi))
        label = multi_labels[idx]
        confidence = float(avg_multi[idx])

    confidence = max(confidence * 100, 1.0)

    print(json.dumps({
        "predicted_class": label,
        "confidence": round(confidence, 2)
    }))

except Exception as e:
    print(json.dumps({"error": str(e)}))