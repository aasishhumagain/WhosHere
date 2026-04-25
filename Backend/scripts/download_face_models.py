from pathlib import Path
from urllib.request import urlopen

MODEL_DOWNLOADS = {
    "face_detection_yunet_2023mar.onnx": "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx?download=true",
    "face_recognition_sface_2021dec.onnx": "https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx?download=true",
}

BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BACKEND_DIR / "models"


def download_file(file_name: str, url: str):
    target_path = MODEL_DIR / file_name

    if target_path.exists():
        print(f"Already present: {target_path.name}")
        return

    print(f"Downloading {file_name}...")

    with urlopen(url) as response, target_path.open("wb") as target_file:
        while True:
            chunk = response.read(1024 * 1024)

            if not chunk:
                break

            target_file.write(chunk)

    print(f"Saved to {target_path}")


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    for file_name, url in MODEL_DOWNLOADS.items():
        download_file(file_name, url)

    print("Face recognition models are ready.")


if __name__ == "__main__":
    main()
