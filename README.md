# DocHub

Startseite des Dokumentenmanagements: alle technischen Anwendungen als Kacheln,
mit Absprung, API-Doku, Techstack und Verknüpfungen zu anderen Systemen.
Jede Person hat eigene Favoriten, Admins pflegen die Inhalte.

Stack (alles lizenzkostenfrei): Python + FastAPI, SQLite (später PostgreSQL),
Vanilla HTML/JavaScript + Bootstrap 5. Alle Bibliotheken liegen lokal unter
`static/vendor/`, es wird nichts aus dem Internet nachgeladen.

## Starten

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

| Adresse                            | Inhalt                                    |
|------------------------------------|-------------------------------------------|
| http://localhost:8000/             | Startseite mit allen Kacheln              |
| http://localhost:8000/pflege.html  | Pflege (nur Admins)                       |
| http://localhost:8000/docs         | Schnittstelle von DocHub (Swagger UI)     |

Beim ersten Start wird `portal.db` angelegt und mit Beispieldaten gefüllt.
Wer neu anfangen will, löscht einfach `portal.db`.

## Anmeldung, Rollen und Favoriten

Woher der angemeldete Benutzer kommt, steht an genau einer Stelle:
`app/auth.py`. Das Frontend fragt nur `GET /api/me` und bekommt zurück:

```json
{ "authenticated": true,
  "user": { "id": 1, "username": "max.muster", "display_name": "Max Muster", "is_admin": false },
  "favorites": ["noa", "doccal"] }
```

Der Modus wird über Umgebungsvariablen eingestellt:

| Variable           | Bedeutung                                                              |
|--------------------|------------------------------------------------------------------------|
| `AUTH_MODE`        | `dev` (Standard) oder `header`                                         |
| `DEV_USER`         | Benutzername im Modus `dev` (Standard: `admin@intern.example`)         |
| `DEV_USER_NAME`    | Anzeigename im Modus `dev`                                             |
| `ADMIN_USERS`      | Kommagetrennte Benutzernamen, die automatisch Admin sind ("erster Admin") |
| `AUTH_HEADER`      | Header mit dem Benutzernamen im Modus `header` (Standard: `X-Forwarded-User`) |
| `AUTH_NAME_HEADER` | Header mit dem Anzeigenamen (Standard: `X-Forwarded-Name`)             |

**`dev`** – zum Entwickeln. Jeder Aufruf gilt als `DEV_USER`, der automatisch Admin ist.
Nicht im Betrieb verwenden.

**`header`** – für SSO über einen vorgeschalteten Webserver. Der Server erledigt die
Anmeldung (z. B. IIS mit Windows-Anmeldung, Apache mit `mod_auth_openidc` oder
`oauth2-proxy` vor Entra ID) und reicht den Benutzernamen per Header weiter.
`DOMAIN\benutzer` wird automatisch zu `benutzer`.

```bash
AUTH_MODE=header ADMIN_USERS=vorname.nachname@aok.de uvicorn app.main:app --host 127.0.0.1 --port 8000
```

> Wichtig: Im Modus `header` darf DocHub **nur über den Proxy** erreichbar sein
> (deshalb `--host 127.0.0.1`). Sonst könnte jemand den Header selbst setzen.

**Später direkt in FastAPI (OIDC gegen Entra ID):** Mit der freien Bibliothek Authlib
lässt sich die Anmeldung auch ohne Proxy einbauen. Dafür wird nur `_identity()` in
`app/auth.py` erweitert; `/api/me`, Rechte, Favoriten und Frontend bleiben unverändert.

**Rechte:** Lesen darf jeder. Favoriten setzen darf jeder Angemeldete. Teams,
Anwendungen und Benutzer ändern dürfen nur Admins – das prüft das Backend bei jedem
Schreibzugriff (`403`), nicht nur die Oberfläche. Admins vergeben weitere Admin-Rechte
unter *Pflege → Benutzer & Rechte*. Es bleibt immer mindestens ein Admin.

## Projektstruktur

```
app/
  main.py          Start, liefert API und Seiten aus
  auth.py          Anmeldung & Rollen (hier wird SSO angeschlossen)
  database.py      Verbindung (SQLite, per DATABASE_URL umstellbar)
  models.py        Team, Application, ApiEndpoint, TechStackItem, Integration, User, Favorite
  schemas.py       Datenformate der JSON-API
  routers/         /api/teams, /api/apps, /api/me, /api/users
  seed.py          Beispieldaten für den ersten Start
static/
  index.html       Startseite (Tabs, Suche, Kacheln, Detail-Dialog, Favoriten)
  app.html         Detailseite: Überblick, API, Techstack, Verknüpfungen
  pflege.html      Pflege: Teams, Anwendungen, Benutzer & Rechte
  css/portal.css   Farben, Schrift, Komponenten
  js/              common.js (Benutzer, Favoriten, Kopfzeile), index.js, app.js, pflege.js
  img/             hier hero.jpg für das Bild im Kopfbereich ablegen
  vendor/          Bootstrap, Bootstrap Icons, Manrope-Schrift, Swagger UI
```

## Anpassen

- **Name und Texte** (DocHub, Abteilung, Organisation, Kontakt-Mail): oben in `static/js/common.js` (`PORTAL`).
- **Bild im Kopfbereich:** als `static/img/hero.jpg` ablegen.
- **Farben:** Variablen am Anfang von `static/css/portal.css`.
- **Icons:** Namen von https://icons.getbootstrap.com.

## Betrieb

- **Wechsel auf PostgreSQL:** `pip install "psycopg[binary]"` und
  `DATABASE_URL=postgresql+psycopg://user:pass@host/dochub` setzen.
- **Sicherung:** Bei SQLite reicht es, `portal.db` regelmäßig zu kopieren.
- **Bestehende Datenbank aus Version 0.1:** Die neuen Tabellen (Benutzer, Favoriten)
  werden beim Start automatisch ergänzt; vorhandene Daten bleiben erhalten.

## Lizenzen der mitgelieferten Bibliotheken

Bootstrap (MIT), Bootstrap Icons (MIT), Manrope (SIL Open Font License),
Swagger UI (Apache 2.0), FastAPI (MIT), SQLModel (MIT), Uvicorn (BSD).
Die Lizenztexte liegen jeweils im Ordner unter `static/vendor/`.
