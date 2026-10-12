"""Benutzer und Admin-Rechte verwalten (nur für Admins)."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from ..auth import require_admin
from ..database import get_session
from ..models import User

router = APIRouter(prefix="/api/users", tags=["Benutzer & Rechte"], dependencies=[Depends(require_admin)])


class UserRow(BaseModel):
    id: int
    username: str
    display_name: str
    is_admin: bool
    last_seen: Optional[datetime] = None


class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    display_name: str = ""
    is_admin: bool = False


class UserPatch(BaseModel):
    is_admin: bool


def _admin_count(session: Session) -> int:
    return session.exec(select(func.count()).select_from(User).where(User.is_admin == True)).one()  # noqa: E712


@router.get("", response_model=List[UserRow], summary="Alle bekannten Benutzer")
def list_users(session: Session = Depends(get_session)):
    return session.exec(select(User).order_by(User.is_admin.desc(), User.display_name, User.username)).all()


@router.post("", response_model=UserRow, status_code=201,
             summary="Benutzer vorab anlegen, z. B. um Admin-Rechte vor der ersten Anmeldung zu vergeben")
def create_user(data: UserCreate, session: Session = Depends(get_session)):
    username = data.username.strip().lower()
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(409, "Diesen Benutzer gibt es schon")
    user = User(username=username, display_name=data.display_name.strip(), is_admin=data.is_admin)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRow, summary="Admin-Recht vergeben oder entziehen")
def update_user(user_id: int, data: UserPatch, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "Benutzer nicht gefunden")
    if user.is_admin and not data.is_admin and _admin_count(session) <= 1:
        raise HTTPException(409, "Es muss mindestens ein Admin bleiben")
    user.is_admin = data.is_admin
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204, summary="Benutzer samt Favoriten entfernen")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "Benutzer nicht gefunden")
    if user.is_admin and _admin_count(session) <= 1:
        raise HTTPException(409, "Es muss mindestens ein Admin bleiben")
    session.delete(user)
    session.commit()
