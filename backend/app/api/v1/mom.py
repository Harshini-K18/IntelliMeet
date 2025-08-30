from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.db.mongo import get_mongo
from app.services.nlp.summarizer import summarize_long
from app.services.nlp.action_extractor import extract_action_items

router = APIRouter()

@router.post("/generate/{tid}")
async def generate_mom(tid: str):
    db = get_mongo()
    try:
        tr = await db.transcripts.find_one({"_id": ObjectId(tid)})
    except Exception:
        raise HTTPException(status_code=400, detail="Bad ID")
    if not tr:
        raise HTTPException(status_code=404, detail="Transcript not found")

    summary = summarize_long(tr.get("text", ""))
    actions = extract_action_items(tr.get("segments", []))

    mom_doc = {
        "transcript_id": tid,
        "summary": summary,
        "action_items": actions,
    }
    await db.mom.update_one({"transcript_id": tid}, {"$set": mom_doc}, upsert=True)
    return mom_doc

@router.get("/{tid}")
async def get_mom(tid: str):
    db = get_mongo()
    doc = await db.mom.find_one({"transcript_id": tid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="MoM not found")
    return doc
