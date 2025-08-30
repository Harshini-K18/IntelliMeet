from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.db.mongo import get_mongo
from app.workers.pipeline_analytics import speaker_stats

router = APIRouter()

@router.get("/{tid}")
async def analytics_for_transcript(tid: str):
    db = get_mongo()
    try:
        tr = await db.transcripts.find_one({"_id": ObjectId(tid)})
    except Exception:
        raise HTTPException(status_code=400, detail="Bad ID")
    if not tr:
        raise HTTPException(status_code=404, detail="Transcript not found")
    stats = speaker_stats(tr.get("segments", []))
    out = {"stats": stats}
    await db.analytics.update_one({"transcript_id": tid}, {"$set": {"transcript_id": tid, **out}}, upsert=True)
    return out
