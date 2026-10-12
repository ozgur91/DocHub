"""Anmeldung: die EINZIGE Stelle, die weiß, woher der Benutzer kommt.

Alle Endpunkte fragen nur `get_current_user`, `require_user` oder `require_admin`.
Wird später SSO eingebunden, ändert sich nur `_identity()` – der Rest
(inkl. /api/me, Favoriten, Admin-Rechte, Frontend) bleibt gleich.

Modus über die Umgebungsvariable AUTH_MODE:

  dev     (Standard) Fester Entwicklungsbenutzer aus DEV_USER / DEV_USER_NAME.
          Praktisch zum Entwickeln und Testen – NICHT für den Betrieb.

  header  Ein vorgeschalteter Webserver/Proxy erledigt das SSO und reicht den
          Benutzer per HTTP-Header weiter (Standard: X-Forwarded-User und
          X-Forwarded-Name). Typisch: IIS mit Windows-Anmeldung, Apache/Nginx
          mit mod_auth_openidc oder oauth2-proxy vor Entra ID.
          WICHTIG: Die Anwendung darf dann nur über diesen Proxy erreichbar sein,
          sonst könnte jemand den Header selbst setzen.

  (später) oidc  Anmeldung direkt in FastAPI gegen Entra ID, z. B. mit der
          freien Bibliothek Authlib. Dafür nur `_identity()` erweitern.

ADMIN_USERS: kommagetrennte Liste von Benutzernamen, die automatisch Admin
werden (der "erste Admin"). Weitere Admins vergibt man danach in der Oberfläche.
"""
import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

from .database import get_session
from .models import User

AUTH_MODE = os.getenv("AUTH_MODE", "dev").lower()
DEV_USER = os.getenv("DEV_USER", "admin@intern.example")
DEV_USER_NAME = os.getenv("DEV_USER_NAME", "Entwicklung Admin")
AUTH_HEADER = os.getenv("AUTH_HEADER", "X-Forwarded-User")
AUTH_NAME_HEADER = os.getenv("AUTH_NAME_HEADER", "X-Forwarded-Name")
ADMIN_USERS = {
    u.strip().lower()
    for u in os.getenv("ADMIN_USERS", DEV_USER if AUTH_MODE == "dev" else "").split(",")
    if u.strip()
}


def _identity(request: Request) -> tuple[str, str] | None:
    """Liefert (benutzername, anzeigename) oder None, wenn niemand angemeldet ist."""
    if AUTH_MODE == "dev":
        return DEV_USER, DEV_USER_NAME
    if AUTH_MODE == "header":
        user = request.headers.get(AUTH_HEADER, "").strip()
        if not user:
            return None
        if "\\" in user:                       # DOMAIN\benutzer -> benutzer
            user = user.split("\\", 1)[1]
        return user, request.headers.get(AUTH_NAME_HEADER, "").strip()
    # Platz für AUTH_MODE == "oidc": Benutzer z. B. aus request.session lesen
    return None


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User | None:
    ident = _identity(request)
    if not ident:
        return None
    username, display_name = ident[0].lower(), ident[1]

    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        user = User(username=username, display_name=display_name or username)
    if username in ADMIN_USERS:
        user.is_admin = True
    if display_name and user.display_name != display_name:
        user.display_name = display_name
    user.last_seen = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if not user:
        raise HTTPException(401, "Nicht angemeldet")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Nur Admins dürfen Änderungen vornehmen")
    return user
