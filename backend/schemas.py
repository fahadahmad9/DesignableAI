from pydantic import BaseModel, EmailStr
from typing import Optional, Any, List
from datetime import datetime

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UploadResponse(BaseModel):
    id: int
    filename: str
    furniture_type: str
    identified_type: Optional[str]
    image_path: str
    created_at: datetime

    class Config:
        from_attributes = True

class SaveProject3DRequest(BaseModel):
    project_name: str
    furniture_type: str  # chair, table, etc.
    parts: List[Any]  # list of placed parts with their data
    textures: dict  # partId -> texture src mapping
    project_metadata: Optional[dict] = None

class Project3DResponse(BaseModel):
    id: int
    user_id: int
    project_name: str
    furniture_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True