import cv2
import numpy as np
import json


def generate_face_encoding(image_path):
    image = cv2.imread(image_path)

    if image is None:
        raise ValueError("Could not read image")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    face_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    faces = face_detector.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(80, 80)
    )

    if len(faces) == 0:
        raise ValueError("No face detected in image")

    x, y, w, h = faces[0]

    face = gray[y:y+h, x:x+w]
    face = cv2.resize(face, (100, 100))
    face = face / 255.0

    encoding = face.flatten().tolist()

    return json.dumps(encoding)


def compare_faces(known_encoding, new_encoding):
    known = np.array(json.loads(known_encoding))
    new = np.array(json.loads(new_encoding))

    distance = np.linalg.norm(known - new)

    return distance