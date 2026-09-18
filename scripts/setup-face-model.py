"""Download Google's pretrained FaceLandmarker v1; never train/fabricate weights."""
from pathlib import Path
from urllib.request import urlopen
from hashlib import sha256
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
EXPECTED_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
target = ROOT / "models/face_landmarker.task"
temporary = target.with_suffix(".task.download")
try:
    with urlopen(URL, timeout=60) as response:
        data = response.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise ValueError("Unexpected model size")
    if sha256(data).hexdigest() != EXPECTED_SHA256:
        raise ValueError("Face model checksum mismatch")
    temporary.write_bytes(data)
    with ZipFile(temporary) as bundle:
        if bundle.testzip() is not None or not bundle.namelist():
            raise ValueError("Invalid model bundle")
    temporary.replace(target)
    print(f"Pretrained face model ready: {target.name}; SHA256 {sha256(data).hexdigest()}")
finally:
    temporary.unlink(missing_ok=True)
