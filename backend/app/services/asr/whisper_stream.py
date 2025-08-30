import tempfile, os
import whisper
from app.core.config import settings

_model = None

def _load_model():
    global _model
    if _model is None:
        _model = whisper.load_model(settings.WHISPER_MODEL)  # cpu ok, gpu auto if available
    return _model

def transcribe_file(file_bytes: bytes, language: str | None = None):
    """
    Returns: dict with segments [{start, end, text}], language, full_text
    """
    model = _load_model()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    try:
        res = model.transcribe(tmp_path, language=language)
        segments = [
            {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()}
            for s in res.get("segments", [])
        ]
        return {
            "language": res.get("language"),
            "text": res.get("text", "").strip(),
            "segments": segments
        }
    finally:
        os.remove(tmp_path)

def transcribe(filepath: str, language: str | None = None):
    """
    Transcribe an audio file from a file path.
    Returns: dict with segments [{start, end, text}], language, full_text
    """
    model = _load_model()
    res = model.transcribe(filepath, language=language)
    segments = [
        {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()}
        for s in res.get("segments", [])
    ]
    return {
        "language": res.get("language"),
        "text": res.get("text", "").strip(),
        "segments": segments
    }