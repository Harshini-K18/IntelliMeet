import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "AI Meeting Agent")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    MONGO_URI: str = os.getenv(
        "MONGO_URI",
        "mongodb://root:pass123@localhost:27017/ai_meeting?authSource=admin"
    )
    MONGO_DB: str = os.getenv("MONGO_DB", "ai_meeting")
    #POSTGRES_URL: str = os.getenv("POSTGRES_URL", "postgresql://user:password@localhost:5432/ai_meeting")
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "base")
    HF_SUMMARIZER: str = os.getenv("HF_SUMMARIZER", "sshleifer/distilbart-cnn-12-6")

settings = Settings()