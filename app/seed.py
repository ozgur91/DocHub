"""Beispieldaten für den ersten Start (nur wenn die Datenbank leer ist).

Die Inhalte sind Platzhalter und sollten über die Pflege-Seite durch
echte Angaben ersetzt werden.
"""
from sqlmodel import Session, select

from .database import engine
from .models import ApiEndpoint, Application, Integration, Team, TechStackItem


def _app(name, slug, icon, color, order, desc, stack, endpoints=(), links=(), **kw):
    return Application(
        name=name, slug=slug, icon=icon, color=color, sort_order=order, description=desc,
        url=kw.pop("url", f"https://{slug}.intern.example"),
        api_base_url=kw.pop("api_base_url", f"https://{slug}.intern.example/api/v1"),
        api_auth=kw.pop("api_auth", "OAuth2 Client Credentials"),
        api_spec_url=kw.pop("api_spec_url", f"https://{slug}.intern.example/openapi.json"),
        contact=kw.pop("contact", "team-outputmanagement@intern.example"),
        tech_stack=[TechStackItem(category=c, name=n, version=v) for c, n, v in stack],
        endpoints=[ApiEndpoint(method=m, path=p, description=d) for m, p, d in endpoints],
        integrations=[Integration(target=t, direction=d, protocol=p, description=x) for t, d, p, x in links],
        **kw,
    )


def _placeholder(name, slug, icon, order):
    return Application(name=name, slug=slug, icon=icon, color="gray", sort_order=order,
                       is_placeholder=True, description="Noch nicht belegt")


def seed_if_empty() -> None:
    with Session(engine) as s:
        if s.exec(select(Team)).first():
            return

        output = Team(name="Outputmanagement", slug="outputmanagement",
                      subtitle="Erstellung, Planung und Prüfung ausgehender Dokumente",
                      icon="files", sort_order=1)
        output.applications = [
            _app("DocCal", "doccal", "calendar3", "green", 1,
                 "Kalender für Versand- und Produktionstermine.",
                 [("Frontend", "Angular", "17"), ("Backend", "Java / Spring Boot", "3.2"),
                  ("Datenbank", "PostgreSQL", "15"), ("Infrastruktur", "OpenShift", "")],
                 [("GET", "/termine", "Termine im Zeitraum abrufen"),
                  ("POST", "/termine", "Neuen Termin anlegen")],
                 [("DocPlan", "both", "REST", "Abgleich der Produktionsplanung")]),
            _app("NOA", "noa", "files", "teal", 2,
                 "Erzeugung und Ablage von Ausgangsdokumenten.",
                 [("Frontend", "React", "18"), ("Backend", "Python / FastAPI", "0.110"),
                  ("Datenbank", "Oracle", "19c")],
                 [("POST", "/dokumente", "Dokument erzeugen"),
                  ("GET", "/dokumente/{id}", "Dokument abrufen")],
                 [("Archivsystem", "out", "SOAP", "Ablage erzeugter Dokumente"),
                  ("DocCraft", "in", "REST", "Übernahme von Vorlagen")]),
            _app("DocCompare", "doccompare", "file-earmark-diff", "blue", 3,
                 "Vergleicht zwei Dokumentversionen und zeigt Unterschiede.",
                 [("Frontend", "Vanilla JS / Bootstrap", "5.3"), ("Backend", "Python / FastAPI", "0.110"),
                  ("Datenbank", "SQLite", "3")],
                 [("POST", "/vergleich", "Zwei Dokumente vergleichen"),
                  ("GET", "/vergleich/{id}/bericht", "Vergleichsbericht als PDF")],
                 [("NOA", "in", "REST", "Bezug der zu vergleichenden Dokumente")]),
            _app("DocCraft", "doccraft", "vector-pen", "red", 4,
                 "Editor für Dokumentvorlagen und Textbausteine.",
                 [("Frontend", "Vue", "3"), ("Backend", "Node.js / Express", "20"),
                  ("Datenbank", "MongoDB", "7")],
                 [("GET", "/vorlagen", "Alle Vorlagen auflisten")],
                 [("NOA", "out", "REST", "Bereitstellung freigegebener Vorlagen")]),
            _app("DocPlan", "docplan", "calendar-week", "amber", 5,
                 "Kapazitäts- und Produktionsplanung für Massendruck.",
                 [("Frontend", "Angular", "16"), ("Backend", "Java / Spring Boot", "3.1"),
                  ("Datenbank", "PostgreSQL", "15")],
                 [("GET", "/auftraege", "Druckaufträge abrufen")],
                 [("DocCal", "both", "REST", "Abgleich der Termine"),
                  ("Druckzentrum", "out", "SFTP", "Übergabe der Druckdateien")]),
        ]

        inp = Team(name="Inputmanagement", slug="inputmanagement",
                   subtitle="Eingang, Erfassung und Klassifizierung von Dokumenten",
                   icon="inbox", sort_order=2)
        inp.applications = [_placeholder("Anwendung 01", "input-01", "upc-scan", 1),
                            _placeholder("Anwendung 02", "input-02", "inbox", 2)]

        anf = Team(name="Anforderungsmanagement", slug="anforderungsmanagement",
                   subtitle="Fachliche Anforderungen aufnehmen und steuern",
                   icon="clipboard-check", sort_order=3)
        anf.applications = [_placeholder("Anwendung 01", "anforderung-01", "clipboard", 1),
                            _placeholder("Anwendung 02", "anforderung-02", "list-check", 2)]

        s.add_all([output, inp, anf])
        s.commit()
