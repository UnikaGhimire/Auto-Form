from datetime import datetime
from sqlalchemy import String, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class User(Base):
    """An anonymous account. The extension creates one on first use and keeps its API key."""
    __tablename__='users'
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TenantMixin:
    """Rows owned by one user. Queries are scoped automatically (see database.py)."""
    user_id: Mapped[str] = mapped_column(String(32), index=True, default='')


class Profile(TenantMixin, Base):
    __tablename__='profile'
    __table_args__=(UniqueConstraint('user_id', name='uq_profile_user'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200), default='')
    email: Mapped[str] = mapped_column(String(320), default='')
    phone: Mapped[str] = mapped_column(String(80), default='')
    location: Mapped[str] = mapped_column(String(300), default='')
    address: Mapped[str] = mapped_column(String(500), default='')
    date_of_birth: Mapped[str] = mapped_column(String(30), default='')
    linkedin: Mapped[str] = mapped_column(String(500), default='')
    github: Mapped[str] = mapped_column(String(500), default='')
    portfolio: Mapped[str] = mapped_column(String(500), default='')
    headline: Mapped[str] = mapped_column(String(300), default='')
    summary: Mapped[str] = mapped_column(Text, default='')
    languages: Mapped[str] = mapped_column(String(300), default='')
    current_company: Mapped[str] = mapped_column(String(300), default='')
    graduation_year: Mapped[str] = mapped_column(String(30), default='')
    work_authorization: Mapped[str] = mapped_column(String(200), default='')
    visa_status: Mapped[str] = mapped_column(String(200), default='')
    availability: Mapped[str] = mapped_column(String(200), default='')
    notice_period: Mapped[str] = mapped_column(String(200), default='')
    salary_expectation: Mapped[str] = mapped_column(String(200), default='')
    references: Mapped[str] = mapped_column(String(500), default='')
    certifications: Mapped[str] = mapped_column(String(500), default='')
    awards: Mapped[str] = mapped_column(String(500), default='')
    interests: Mapped[str] = mapped_column(String(500), default='')
class Education(TenantMixin, Base):
    __tablename__='education'; id: Mapped[int]=mapped_column(primary_key=True)
    institution: Mapped[str]=mapped_column(String(300)); degree: Mapped[str]=mapped_column(String(300),default=''); field: Mapped[str]=mapped_column(String(300),default='')
    start_date: Mapped[str]=mapped_column(String(30),default=''); end_date: Mapped[str]=mapped_column(String(30),default=''); grade: Mapped[str]=mapped_column(String(100),default=''); description: Mapped[str]=mapped_column(Text,default='')
class Experience(TenantMixin, Base):
    __tablename__='experience'; id: Mapped[int]=mapped_column(primary_key=True)
    company: Mapped[str]=mapped_column(String(300)); position: Mapped[str]=mapped_column(String(300),default=''); start_date: Mapped[str]=mapped_column(String(30),default=''); end_date: Mapped[str]=mapped_column(String(30),default=''); description: Mapped[str]=mapped_column(Text,default='')
class Skill(TenantMixin, Base):
    __tablename__='skills'; __table_args__=(UniqueConstraint('user_id', 'name', name='uq_skill_user_name'),)
    id: Mapped[int]=mapped_column(primary_key=True); name: Mapped[str]=mapped_column(String(200))
class Project(TenantMixin, Base):
    __tablename__='projects'; id: Mapped[int]=mapped_column(primary_key=True); name: Mapped[str]=mapped_column(String(300)); description: Mapped[str]=mapped_column(Text,default=''); technologies: Mapped[str]=mapped_column(Text,default=''); role: Mapped[str]=mapped_column(String(300),default=''); url: Mapped[str]=mapped_column(String(500),default='')
class PreviousAnswer(TenantMixin, Base):
    __tablename__='previous_answers'; id: Mapped[int]=mapped_column(primary_key=True); question: Mapped[str]=mapped_column(Text); answer: Mapped[str]=mapped_column(Text); created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); updated_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow,onupdate=datetime.utcnow)
class CVDocument(TenantMixin, Base):
    __tablename__='cv_documents'; id: Mapped[int]=mapped_column(primary_key=True)
    filename: Mapped[str]=mapped_column(String(500)); extracted_text: Mapped[str]=mapped_column(Text)
    created_at: Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
