"""Ein- und Ausgabeformate der JSON-API."""
from typing import List, Optional

from pydantic import BaseModel, Field


class EndpointIn(BaseModel):
    method: str = "GET"
    path: str
    description: str = ""


class TechIn(BaseModel):
    category: str
    name: str
    version: str = ""


class IntegrationIn(BaseModel):
    target: str
    direction: str = "out"
    protocol: str = ""
    description: str = ""


class ApplicationIn(BaseModel):
    team_id: int
    name: str = Field(min_length=1)
    slug: Optional[str] = None
    description: str = ""
    icon: str = "app"
    color: str = "green"
    url: str = ""
    contact: str = ""
    is_placeholder: bool = False
    sort_order: int = 0
    api_base_url: str = ""
    api_auth: str = ""
    api_spec_url: str = ""
    api_notes: str = ""
    endpoints: List[EndpointIn] = []
    tech_stack: List[TechIn] = []
    integrations: List[IntegrationIn] = []


class ApplicationOut(ApplicationIn):
    id: int
    slug: str
    team_name: str = ""
    team_slug: str = ""


class ApplicationCard(BaseModel):
    id: int
    team_id: int
    name: str
    slug: str
    description: str
    icon: str
    color: str
    url: str
    is_placeholder: bool
    sort_order: int


class TeamIn(BaseModel):
    name: str = Field(min_length=1)
    slug: Optional[str] = None
    subtitle: str = ""
    icon: str = "folder"
    sort_order: int = 0


class TeamOut(TeamIn):
    id: int
    slug: str
    applications: List[ApplicationCard] = []
