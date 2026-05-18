from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    furniture_type = Column(String, nullable=False)
    identified_type = Column(String, nullable=True)
    image_path = Column(String, nullable=False)   # path to saved file on disk
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Project3D(Base):
    __tablename__ = "projects_3d"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_name = Column(String, nullable=False)
    furniture_type = Column(String, nullable=False)  # chair, table, etc.
    project_data = Column(Text, nullable=False)  # JSON string containing all parts, materials, scales
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())