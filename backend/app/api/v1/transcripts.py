from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.db.mongo import get_mongo

router = APIRouter()

@router.get("/{tid}")
async def get_transcript(tid: str):
    db = get_mongo()
    try:
        doc = await db.transcripts.find_one({"_id": ObjectId(tid)}, {"_id": 0})
    except Exception:
        raise HTTPException(status_code=400, detail="Bad ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc