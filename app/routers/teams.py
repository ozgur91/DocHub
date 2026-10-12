from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import require_admin
from ..database import get_session
from ..models import Team
from ..schemas import ApplicationCard, TeamIn, TeamOut
from ..utils import slugify

router = APIRouter(prefix="/api/teams", tags=["Teams"])


def _to_out(team: Team) -> TeamOut:
    apps = sorted(team.applications, key=lambda a: (a.is_placeholder, a.sort_order, a.name))
    return TeamOut(
        id=team.id, name=team.name, slug=team.slug, subtitle=team.subtitle,
        icon=team.icon, sort_order=team.sort_order,
        applications=[ApplicationCard.model_validate(a, from_attributes=True) for a in apps],
    )


def _unique_slug(session: Session, wanted: str, own_id: int | None = None) -> str:
    base, slug, n = wanted, wanted, 2
    while True:
        hit = session.exec(select(Team).where(Team.slug == slug)).first()
        if not hit or hit.id == own_id:
            return slug
        slug, n = f"{base}-{n}", n + 1


@router.get("", response_model=List[TeamOut], summary="Alle Teams mit ihren Anwendungen")
def list_teams(session: Session = Depends(get_session)):
    teams = session.exec(select(Team).order_by(Team.sort_order, Team.name)).all()
    return [_to_out(t) for t in teams]


@router.post("", response_model=TeamOut, status_code=201, summary="Team anlegen", dependencies=[Depends(require_admin)])
def create_team(data: TeamIn, session: Session = Depends(get_session)):
    team = Team(**data.model_dump(exclude={"slug"}))
    team.slug = _unique_slug(session, slugify(data.slug or data.name))
    session.add(team)
    session.commit()
    session.refresh(team)
    return _to_out(team)


@router.put("/{team_id}", response_model=TeamOut, summary="Team ändern", dependencies=[Depends(require_admin)])
def update_team(team_id: int, data: TeamIn, session: Session = Depends(get_session)):
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")
    for key, value in data.model_dump(exclude={"slug"}).items():
        setattr(team, key, value)
    team.slug = _unique_slug(session, slugify(data.slug or data.name), team.id)
    session.add(team)
    session.commit()
    session.refresh(team)
    return _to_out(team)


@router.delete("/{team_id}", status_code=204, summary="Team samt Anwendungen löschen", dependencies=[Depends(require_admin)])
def delete_team(team_id: int, session: Session = Depends(get_session)):
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team nicht gefunden")
    session.delete(team)
    session.commit()
