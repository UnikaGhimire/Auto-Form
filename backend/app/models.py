from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class Profile(Base):
    __tablename__='profile'
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    full_name: Mapped[str] = mapped_column(String(200), default='')
    email: Mapped[str] = mapped_column(String(320), default='')
    phone: Mapped[str] = mapped_column(String(80), default='')
    location: Mapped[str] = mapped_column(String(300), default='')
    date_of_birth: Mapped[str] = mapped_column(String(30), default='')
    linkedin: Mapped[str] = mapped_column(String(500), default='')
    github: Mapped[str] = mapped_column(String(500), default='')
    portfolio: Mapped[str] = mapped_column(String(500), default='')
class Education(Base):
    __tablename__='education'; id: Mapped[int]=mapped_column(primary_key=True)
    institution: Mapped[str]=mapped_column(String(300)); degree: Mapped[str]=mapped_column(String(300),default=''); field: Mapped[str]=mapped_column(String(300),default='')
    start_date: Mapped[str]=mapped_column(String(30),default=''); end_date: Mapped[str]=mapped_column(String(30),default=''); grade: Mapped[str]=mapped_column(String(100),default=''); description: Mapped[str]=mapped_column(Text,default='')
class Experience(Base):
    __tablename__='experience'; id: Mapped[int]=mapped_column(primary_key=True)
    company: Mapped[str]=mapped_column(String(300)); position: Mapped[str]=mapped_column(String(300),default=''); start_date: Mapped[str]=mapped_column(String(30),default=''); end_date: Mapped[str]=mapped_column(String(30),default=''); description: Mapped[str]=mapped_column(Text,default='')
class Skill(Base):
    __tablename__='skills'; id: Mapped[int]=mapped_column(primary_key=True); name: Mapped[str]=mapped_column(String(200), unique=True)
class Project(Base):
    __tablename__='projects'; id: Mapped[int]=mapped_column(primary_key=True); name: Mapped[str]=mapped_column(String(300)); description: Mapped[str]=mapped_column(Text,default=''); technologies: Mapped[str]=mapped_column(Text,default=''); role: Mapped[str]=mapped_column(String(300),default=''); url: Mapped[str]=mapped_column(String(500),default='')
class PreviousAnswer(Base):
    __tablename__='previous_answers'; id: Mapped[int]=mapped_column(primary_key=True); question: Mapped[str]=mapped_column(Text); answer: Mapped[str]=mapped_column(Text); created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); updated_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
