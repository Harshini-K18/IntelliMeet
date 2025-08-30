from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import meetings, mom, analytics, transcripts, recorder
from app.db.mongo import get_mongo


app = FastAPI(title=settings.PROJECT_NAME)

# CORS for your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root route
@app.get("/")
async def root():
    return {"message": "AI Meeting Agent backend is running 🚀"}

# MongoDB health check
@app.get("/health")
async def health_check():
    try:
        db = get_mongo()
        # List collections to ensure connection works
        collections = await db.list_collection_names()
        return {"status": "ok", "collections": collections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MongoDB connection failed: {e}")

# Routers
app.include_router(meetings.router, prefix=f"{settings.API_V1_STR}/meetings", tags=["meetings"])
app.include_router(transcripts.router, prefix=f"{settings.API_V1_STR}/transcripts", tags=["transcripts"])
app.include_router(mom.router, prefix=f"{settings.API_V1_STR}/mom", tags=["mom"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])
app.include_router(recorder.router, prefix=f"{settings.API_V1_STR}/recorder", tags=["recorder"])
