from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

_client = None
_db = None

def get_mongo():
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(settings.MONGO_URI)
        _db = _client[settings.MONGO_DB]
    return _db
