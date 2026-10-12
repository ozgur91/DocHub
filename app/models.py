"""Datenmodell von DocHub."""
from datetime import datetime, timezone
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    subtitle: str = ""
    icon: str = "folder"            # Name eines Bootstrap-Icons, z. B. "files"
    sort_order: int = 0

    applications: List["Application"] = Relationship(
        back_populates="team", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Application(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    name: str
    slug: str = Field(unique=True, index=True)
    description: str = ""
    icon: str = "app"
    color: str = "green"            # green | teal | blue | red | amber | violet | gray
    url: str = ""                   # Absprung in die Anwendung
    contact: str = ""               # Ansprechpartner / Team-Postfach
    is_placeholder: bool = False    # Platzhalter-Kachel ("Noch nicht belegt")
    sort_order: int = 0

    # API-Grunddaten (1:1, daher direkt an der Anwendung)
    api_base_url: str = ""
    api_auth: str = ""              # z. B. "OAuth2 Client Credentials", "API-Key"
    api_spec_url: str = ""          # Link zur OpenAPI-/Swagger-Spezifikation
    api_notes: str = ""

    team: Optional[Team] = Relationship(back_populates="applications")
    endpoints: List["ApiEndpoint"] = Relationship(
        back_populates="application", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    tech_stack: List["TechStackItem"] = Relationship(
        back_populates="application", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    integrations: List["Integration"] = Relationship(
        back_populates="application", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ApiEndpoint(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True)
    method: str = "GET"
    path: str
    description: str = ""
    application: Optional[Application] = Relationship(back_populates="endpoints")


class TechStackItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True)
    category: str                   # Frontend | Backend | Datenbank | Infrastruktur | Sonstiges
    name: str
    version: str = ""
    application: Optional[Application] = Relationship(back_populates="tech_stack")


class Integration(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True)
    target: str                     # verbundenes System
    direction: str = "out"          # out (sendet) | in (empfängt) | both
    protocol: str = ""              # REST, SOAP, SFTP, Kafka, ...
    description: str = ""
    application: Optional[Application] = Relationship(back_populates="integrations")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """Benutzer werden beim ersten Aufruf automatisch angelegt (aus SSO bzw. Entwicklungsmodus)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)   # z. B. UPN/E-Mail aus dem SSO, immer kleingeschrieben
    display_name: str = ""
    is_admin: bool = False
    created_at: datetime = Field(default_factory=_now)
    last_seen: Optional[datetime] = None


class Favorite(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True, ondelete="CASCADE")
    application_id: int = Field(foreign_key="application.id", primary_key=True, ondelete="CASCADE")
