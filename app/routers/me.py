from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user, require_user
from ..database import get_session
from ..models import Application, Favorite, User

router = APIRouter(prefix="/api/me", tags=["Angemeldeter Benutzer"])


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    is_admin: bool


class MeOut(BaseModel):
    authenticated: bool
    user: Optional[UserOut] = None
    favorites: List[str] = []          # Slugs der favorisierten Anwendungen


def _favorite_slugs(session: Session, user: User) -> List[str]:
    stmt = (select(Application.slug)
            .join(Favorite, Favorite.application_id == Application.id)
            .where(Favorite.user_id == user.id))
    return list(session.exec(stmt).all())


def _app_or_404(session: Session, slug: str) -> Application:
    app = session.exec(select(Application).where(Application.slug == slug)).first()
    if not app:
        raise HTTPException(404, "Anwendung nicht gefunden")
    return app


@router.get("", response_model=MeOut, summary="Aktuell angemeldeter Benutzer inkl. Rolle und Favoriten")
def me(user: User | None = Depends(get_current_user), session: Session = Depends(get_session)):
    if not user:
        return MeOut(authenticated=False)
    return MeOut(authenticated=True, user=UserOut.model_validate(user, from_attributes=True),
                 favorites=_favorite_slugs(session, user))


@router.put("/favorites/{slug}", response_model=List[str], summary="Anwendung zu den Favoriten hinzufügen")
def add_favorite(slug: str, user: User = Depends(require_user), session: Session = Depends(get_session)):
    app = _app_or_404(session, slug)
    if not session.get(Favorite, (user.id, app.id)):
        session.add(Favorite(user_id=user.id, application_id=app.id))
        session.commit()
    return _favorite_slugs(session, user)


@router.delete("/favorites/{slug}", response_model=List[str], summary="Anwendung aus den Favoriten entfernen")
def remove_favorite(slug: str, user: User = Depends(require_user), session: Session = Depends(get_session)):
    app = _app_or_404(session, slug)
    fav = session.get(Favorite, (user.id, app.id))
    if fav:
        session.delete(fav)
        session.commit()
    return _favorite_slugs(session, user)
