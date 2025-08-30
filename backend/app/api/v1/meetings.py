from fastapi import APIRouter, UploadFile, File, HTTPException
from app.db.mongo import get_mongo
from app.services.asr.whisper_stream import transcribe_file

router = APIRouter()

@router.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...), language: str | None = None):
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".webm")):
        raise HTTPException(status_code=400, detail="Please upload wav/mp3/m4a/webm")
    
    try:
        data = await file.read()
        tr = transcribe_file(data, language=language)  # could fail
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    
    try:
        db = get_mongo()
        doc = {
            "filename": file.filename,
            "language": tr["language"],
            "text": tr["text"],
            "segments": tr["segments"],
        }
        res = await db.transcripts.insert_one(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB insertion failed: {e}")
    
    return {"transcript_id": str(res.inserted_id), "segments": tr["segments"][:5]}  # preview