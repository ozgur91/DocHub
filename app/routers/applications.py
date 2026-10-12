from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import require_admin
from ..database import get_session
from ..models import ApiEndpoint, Application, Integration, Team, TechStackItem
from ..schemas import ApplicationIn, ApplicationOut
from ..utils import slugify

router = APIRouter(prefix="/api/apps", tags=["Anwendungen"])

_SCALARS = ("team_id", "name", "description", "icon", "color", "url", "contact",
            "is_placeholder", "sort_order", "api_base_url", "api_auth",
            "api_spec_url", "api_notes")


def _to_out(app: Application) -> ApplicationOut:
    return ApplicationOut(
        id=app.id, slug=app.slug,
        team_name=app.team.name if app.team else "",
        team_slug=app.team.slug if app.team else "",
        **{k: getattr(app, k) for k in _SCALARS},
        endpoints=[e.model_dump() for e in app.endpoints],
        tech_stack=[t.model_dump() for t in app.tech_stack],
        integrations=[i.model_dump() for i in app.integrations],
    )


def _unique_slug(session: Session, wanted: str, own_id: int | None = None) -> str:
    base, slug, n = wanted, wanted, 2
    while True:
        hit = session.exec(select(Application).where(Application.slug == slug)).first()
        if not hit or hit.id == own_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


def _apply(session: Session, app: Application, data: ApplicationIn) -> None:
    if not session.get(Team, data.team_id):
        raise HTTPException(422, "Das gewählte Team existiert nicht")
    for key in _SCALARS:
        setattr(app, key, getattr(data, key))
    app.slug = _unique_slug(session, slugify(data.slug or data.name), app.id)
    # Unterlisten werden komplett ersetzt – einfach und nachvollziehbar
    app.endpoints = [ApiEndpoint(**e.model_dump()) for e in data.endpoints if e.path.strip()]
    app.tech_stack = [TechStackItem(**t.model_dump()) for t in data.tech_stack if t.name.strip()]
    app.integrations = [Integration(**i.model_dump()) for i in data.integrations if i.target.strip()]


def _get_or_404(session: Session, key: str) -> Application:
    app = session.exec(select(Application).where(Application.slug == key)).first()
    if not app and key.isdigit():
        app = session.get(Application, int(key))
    if not app:
        raise HTTPException(404, "Anwendung nicht gefunden")
    return app


@router.get("/{key}", response_model=ApplicationOut, summary="Anwendung mit allen Details (per Slug oder ID)")
def get_app(key: str, session: Session = Depends(get_session)):
    return _to_out(_get_or_404(session, key))


@router.post("", response_model=ApplicationOut, status_code=201, summary="Anwendung anlegen", dependencies=[Depends(require_admin)])
def create_app(data: ApplicationIn, session: Session = Depends(get_session)):
    app = Application(team_id=data.team_id, name=data.name, slug="")
    _apply(session, app, data)
    session.add(app)
    session.commit()
    session.refresh(app)
    return _to_out(app)


@router.put("/{app_id}", response_model=ApplicationOut, summary="Anwendung ändern", dependencies=[Depends(require_admin)])
def update_app(app_id: int, data: ApplicationIn, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Anwendung nicht gefunden")
    _apply(session, app, data)
    session.add(app)
    session.commit()
    session.refresh(app)
    return _to_out(app)


@router.delete("/{app_id}", status_code=204, summary="Anwendung löschen", dependencies=[Depends(require_admin)])
def delete_app(app_id: int, session: Session = Depends(get_session)):
    app = session.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Anwendung nicht gefunden")
    session.delete(app)
    session.commit()
