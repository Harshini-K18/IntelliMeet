from fastapi import APIRouter, HTTPException
from app.services.audio.recorder import start_recording, stop_recording
from app.services.asr.whisper_stream import transcribe
from app.db.mongo import get_mongo
from bson import ObjectId

router = APIRouter()
recording_process = None
recording_filename = "meeting_recording.wav"

@router.post("/start")
def start():
    global recording_process
    if recording_process is not None:
        raise HTTPException(status_code=400, detail="Recording already in progress")
    recording_process = start_recording(recording_filename)
    return {"status": "recording started"}

@router.post("/stop")
async def stop():
    global recording_process
    if recording_process is None:
        raise HTTPException(status_code=400, detail="No recording in progress")
    stop_recording(recording_process)
    recording_process = None

    # Automatically transcribe after stopping
    transcript = transcribe(recording_filename)

    # Save transcript to MongoDB
    db = get_mongo()
    doc = {
        "audio_path": recording_filename,
        "segments": transcript["segments"],
        "text": transcript["text"],
        "language": transcript["language"]
    }
    result = await db.transcripts.insert_one(doc)
    transcript_id = str(result.inserted_id)

    return {
        "status": "recording stopped",
        "transcript_id": transcript_id
    }