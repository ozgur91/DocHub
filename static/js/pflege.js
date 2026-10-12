/* Pflege: Teams, Anwendungen sowie Benutzer & Rechte (nur für Admins) */
let teams = [];
let selection = null;   // { type: "team"|"app", id } oder null

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const CATEGORIES = ["Frontend", "Backend", "Datenbank", "Infrastruktur", "Sonstiges"];
const DIRECTIONS = [["out", "sendet an"], ["in", "empfängt von"], ["both", "beidseitig"]];
const COLOR_LABELS = { green: "Grün", teal: "Petrol", blue: "Blau", red: "Rot", amber: "Gelb", violet: "Violett", gray: "Grau" };

const options = (list, current) => list.map(o => {
  const [value, label] = Array.isArray(o) ? o : [o, o];
  return `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
}).join("");

function notify(text, kind = "success") {
  const el = document.getElementById("alert");
  el.className = `alert alert-${kind}`;
  el.textContent = text;
  clearTimeout(notify.t);
  notify.t = setTimeout(() => el.classList.add("d-none"), 4000);
}

/* ---------- Linke Liste ---------- */
function renderTree() {
  document.getElementById("tree").innerHTML = teams.map(t => `
    <button class="list-group-item list-group-item-action team-row d-flex align-items-center gap-2
      ${selection?.type === "team" && selection.id === t.id ? "active" : ""}" data-team="${t.id}">
      <i class="bi bi-${esc(t.icon)}"></i>${esc(t.name)}<i class="bi bi-pencil ms-auto small"></i></button>
    ${t.applications.map(a => `
      <button class="list-group-item list-group-item-action ps-4 d-flex align-items-center gap-2
        ${selection?.type === "app" && selection.id === a.id ? "active" : ""}" data-app="${a.id}">
        <i class="bi bi-${esc(a.icon)}"></i>${esc(a.name)}
        ${a.is_placeholder ? `<span class="p-count neutral ms-auto">Platzhalter</span>` : ""}</button>`).join("")}
    <button class="list-group-item list-group-item-action ps-4 text-success small" data-new-app="${t.id}">
      <i class="bi bi-plus-lg me-1"></i>Anwendung hinzufügen</button>`).join("");
}

/* ---------- Team-Formular ---------- */
function teamForm(team) {
  const isNew = !team.id;
  document.getElementById("editor").innerHTML = `
    <form id="team-form" novalidate>
      <h2 class="h5 mb-4">${isNew ? "Neues Team" : `Team „${esc(team.name)}“`}</h2>
      <div class="row g-3">
        <div class="col-md-8"><label class="form-label">Name</label>
          <input class="form-control" name="name" required value="${esc(team.name)}"></div>
        <div class="col-md-4"><label class="form-label">Reihenfolge</label>
          <input class="form-control" type="number" name="sort_order" value="${team.sort_order ?? 0}"></div>
        <div class="col-12"><label class="form-label">Untertitel</label>
          <input class="form-control" name="subtitle" value="${esc(team.subtitle)}"></div>
        <div class="col-md-8"><label class="form-label">Icon</label>
          <div class="input-group"><span class="input-group-text"><i class="bi bi-${esc(team.icon)}" id="icon-preview"></i></span>
          <input class="form-control" name="icon" value="${esc(team.icon || "folder")}" data-icon-input></div>
          <div class="form-text">Name eines <a href="https://icons.getbootstrap.com" target="_blank" rel="noopener">Bootstrap-Icons</a>, z. B. files, inbox, clipboard-check.</div></div>
      </div>
      <div class="d-flex gap-2 mt-4">
        <button class="btn btn-primary" type="submit">${isNew ? "Team anlegen" : "Änderungen speichern"}</button>
        ${isNew ? "" : `<button class="btn btn-outline-danger ms-auto" type="button" id="delete-team">Team löschen</button>`}
      </div>
    </form>`;

  const form = document.getElementById("team-form");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = { name: fd.get("name").trim(), subtitle: fd.get("subtitle"), icon: fd.get("icon").trim() || "folder",
                   sort_order: Number(fd.get("sort_order")) || 0 };
    if (!body.name) return notify("Bitte einen Namen für das Team eintragen.", "warning");
    try {
      const saved = await api(isNew ? "/api/teams" : `/api/teams/${team.id}`, { method: isNew ? "POST" : "PUT", body });
      notify(isNew ? "Team angelegt." : "Team gespeichert.");
      await reload({ type: "team", id: saved.id });
    } catch (err) { notify(err.message, "danger"); }
  });
  document.getElementById("delete-team")?.addEventListener("click", async () => {
    if (!confirm(`Team „${team.name}“ mit allen ${team.applications.length} Anwendungen löschen?`)) return;
    try { await api(`/api/teams/${team.id}`, { method: "DELETE" }); notify("Team gelöscht."); await reload(null); }
    catch (err) { notify(err.message, "danger"); }
  });
}

/* ---------- Anwendungs-Formular ---------- */
const rowTemplates = {
  endpoints: (e = {}) => `
    <div class="row" data-row>
      <div class="col-3 col-md-2"><select class="form-select" data-k="method">${options(METHODS, e.method || "GET")}</select></div>
      <div class="col-9 col-md-4"><input class="form-control" data-k="path" placeholder="/pfad/{id}" value="${esc(e.path)}"></div>
      <div class="col-10 col-md-5"><input class="form-control" data-k="description" placeholder="Wozu dient der Endpunkt?" value="${esc(e.description)}"></div>
      <div class="col-2 col-md-1"><button type="button" class="btn btn-outline-secondary w-100" data-remove aria-label="Zeile entfernen"><i class="bi bi-x-lg"></i></button></div>
    </div>`,
  tech_stack: (t = {}) => `
    <div class="row" data-row>
      <div class="col-md-3"><select class="form-select" data-k="category">${options(CATEGORIES, t.category || "Backend")}</select></div>
      <div class="col-7 col-md-5"><input class="form-control" data-k="name" placeholder="z. B. Python / FastAPI" value="${esc(t.name)}"></div>
      <div class="col-3 col-md-3"><input class="form-control" data-k="version" placeholder="Version" value="${esc(t.version)}"></div>
      <div class="col-2 col-md-1"><button type="button" class="btn btn-outline-secondary w-100" data-remove aria-label="Zeile entfernen"><i class="bi bi-x-lg"></i></button></div>
    </div>`,
  integrations: (i = {}) => `
    <div class="row" data-row>
      <div class="col-md-3"><input class="form-control" data-k="target" placeholder="System" value="${esc(i.target)}"></div>
      <div class="col-6 col-md-3"><select class="form-select" data-k="direction">${options(DIRECTIONS, i.direction || "out")}</select></div>
      <div class="col-6 col-md-2"><input class="form-control" data-k="protocol" placeholder="REST, SFTP …" value="${esc(i.protocol)}"></div>
      <div class="col-10 col-md-3"><input class="form-control" data-k="description" placeholder="Zweck" value="${esc(i.description)}"></div>
      <div class="col-2 col-md-1"><button type="button" class="btn btn-outline-secondary w-100" data-remove aria-label="Zeile entfernen"><i class="bi bi-x-lg"></i></button></div>
    </div>`,
};

function rowsBlock(key, title, addLabel, items) {
  return `
    <h3 class="p-form-section">${title}</h3>
    <div class="p-rows" data-rows="${key}">${items.map(rowTemplates[key]).join("")}</div>
    <button type="button" class="btn btn-sm btn-outline-primary" data-add="${key}"><i class="bi bi-plus-lg me-1"></i>${addLabel}</button>`;
}

function appForm(app) {
  const isNew = !app.id;
  const field = (name, label, value, attrs = "", col = "col-md-6") =>
    `<div class="${col}"><label class="form-label" for="f-${name}">${label}</label>
     <input class="form-control" id="f-${name}" name="${name}" value="${esc(value)}" ${attrs}></div>`;

  document.getElementById("editor").innerHTML = `
    <form id="app-form" novalidate>
      <div class="d-flex align-items-center gap-3 mb-4">
        <span id="app-icon-preview">${appIcon(app)}</span>
        <h2 class="h5 mb-0">${isNew ? "Neue Anwendung" : esc(app.name)}</h2>
        ${isNew || app.is_placeholder ? "" : `<a class="ms-auto small" href="/app.html?app=${encodeURIComponent(app.slug)}">Ansehen <i class="bi bi-box-arrow-up-right"></i></a>`}
      </div>

      <div class="row g-3">
        ${field("name", "Name", app.name, "required")}
        <div class="col-md-6"><label class="form-label" for="f-team">Team</label>
          <select class="form-select" id="f-team" name="team_id">${options(teams.map(t => [String(t.id), t.name]), String(app.team_id))}</select></div>
        <div class="col-12"><label class="form-label" for="f-desc">Beschreibung</label>
          <textarea class="form-control" id="f-desc" name="description" rows="2">${esc(app.description)}</textarea></div>
        ${field("url", "Adresse der Anwendung", app.url, 'type="url" placeholder="https://…"')}
        ${field("contact", "Ansprechpartner", app.contact, 'placeholder="Name oder Team-Postfach"')}
        ${field("icon", "Icon", app.icon, "data-icon-input", "col-md-5")}
        <div class="col-md-4"><label class="form-label" for="f-color">Farbe</label>
          <select class="form-select" id="f-color" name="color">${options(Object.entries(COLOR_LABELS), app.color)}</select></div>
        ${field("sort_order", "Reihenfolge", app.sort_order ?? 0, 'type="number"', "col-md-3")}
        <div class="col-12"><div class="form-check">
          <input class="form-check-input" type="checkbox" id="f-ph" name="is_placeholder" ${app.is_placeholder ? "checked" : ""}>
          <label class="form-check-label" for="f-ph">Platzhalter – Platz ist noch nicht belegt</label></div></div>
      </div>

      <h3 class="p-form-section">API</h3>
      <div class="row g-3">
        ${field("api_base_url", "Basis-URL", app.api_base_url, 'placeholder="https://…/api/v1"')}
        ${field("api_auth", "Authentifizierung", app.api_auth, 'placeholder="z. B. OAuth2, API-Key"')}
        ${field("api_spec_url", "Link zur Spezifikation (OpenAPI/Swagger)", app.api_spec_url, "", "col-12")}
        <div class="col-12"><label class="form-label" for="f-notes">Hinweise</label>
          <textarea class="form-control" id="f-notes" name="api_notes" rows="2">${esc(app.api_notes)}</textarea></div>
      </div>
      ${rowsBlock("endpoints", "Endpunkte", "Endpunkt hinzufügen", app.endpoints)}
      ${rowsBlock("tech_stack", "Techstack", "Technologie hinzufügen", app.tech_stack)}
      ${rowsBlock("integrations", "API-Verknüpfungen", "Verknüpfung hinzufügen", app.integrations)}

      <div class="d-flex gap-2 mt-5 pt-3 border-top">
        <button class="btn btn-primary" type="submit">${isNew ? "Anwendung anlegen" : "Änderungen speichern"}</button>
        ${isNew ? "" : `<button class="btn btn-outline-danger ms-auto" type="button" id="delete-app">Anwendung löschen</button>`}
      </div>
    </form>`;

  const form = document.getElementById("app-form");
  const preview = () => {
    document.getElementById("app-icon-preview").innerHTML =
      appIcon({ icon: form.icon.value.trim() || "app", color: form.color.value });
  };
  form.icon.addEventListener("input", preview);
  form.color.addEventListener("change", preview);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const collect = key => [...form.querySelectorAll(`[data-rows="${key}"] [data-row]`)].map(row =>
      Object.fromEntries([...row.querySelectorAll("[data-k]")].map(el => [el.dataset.k, el.value.trim()])));
    const body = {
      team_id: Number(fd.get("team_id")), name: fd.get("name").trim(), slug: isNew ? null : app.slug,
      description: fd.get("description").trim(), url: fd.get("url").trim(), contact: fd.get("contact").trim(),
      icon: fd.get("icon").trim() || "app", color: fd.get("color"), sort_order: Number(fd.get("sort_order")) || 0,
      is_placeholder: form.is_placeholder.checked,
      api_base_url: fd.get("api_base_url").trim(), api_auth: fd.get("api_auth").trim(),
      api_spec_url: fd.get("api_spec_url").trim(), api_notes: fd.get("api_notes").trim(),
      endpoints: collect("endpoints"), tech_stack: collect("tech_stack"), integrations: collect("integrations"),
    };
    if (!body.name) return notify("Bitte einen Namen für die Anwendung eintragen.", "warning");
    try {
      const saved = await api(isNew ? "/api/apps" : `/api/apps/${app.id}`, { method: isNew ? "POST" : "PUT", body });
      notify(isNew ? "Anwendung angelegt." : "Anwendung gespeichert.");
      await reload({ type: "app", id: saved.id });
    } catch (err) { notify(err.message, "danger"); }
  });

  document.getElementById("delete-app")?.addEventListener("click", async () => {
    if (!confirm(`Anwendung „${app.name}“ löschen?`)) return;
    try { await api(`/api/apps/${app.id}`, { method: "DELETE" }); notify("Anwendung gelöscht."); await reload(null); }
    catch (err) { notify(err.message, "danger"); }
  });
}

/* ---------- Benutzer & Rechte ---------- */
const fmtDate = iso => iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "noch nie";

async function usersView() {
  selection = { type: "users" };
  renderTree();
  if (location.hash !== "#benutzer") history.replaceState(null, "", "#benutzer");
  let users = [];
  try { users = await api("/api/users"); } catch (err) { return notify(err.message, "danger"); }
  const rows = users.map(u => `
    <tr>
      <td><span class="p-avatar d-inline-grid me-2" style="width:30px;height:30px;font-size:.7rem">${esc(initials(u.display_name || u.username))}</span>
          <strong>${esc(u.display_name || u.username)}</strong>${u.id === ME.user?.id ? ` <span class="p-count neutral">Du</span>` : ""}
          <div class="small text-muted">${esc(u.username)}</div></td>
      <td class="small text-muted">${fmtDate(u.last_seen)}</td>
      <td><div class="form-check form-switch m-0">
        <input class="form-check-input" type="checkbox" role="switch" id="adm-${u.id}" data-admin="${u.id}" ${u.is_admin ? "checked" : ""}>
        <label class="form-check-label small" for="adm-${u.id}">Admin</label></div></td>
      <td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-del-user="${u.id}" data-name="${esc(u.display_name || u.username)}"
        aria-label="Benutzer entfernen"><i class="bi bi-trash"></i></button></td>
    </tr>`).join("");

  document.getElementById("editor").innerHTML = `
    <h2 class="h5 mb-1">Benutzer &amp; Rechte</h2>
    <p class="text-muted small mb-4">Benutzer erscheinen hier automatisch nach ihrer ersten Anmeldung.
      Admins können Teams und Anwendungen ändern, alle anderen haben Lesezugriff und eigene Favoriten.</p>
    <div class="p-panel p-0 overflow-auto mb-4"><table class="table p-table">
      <thead><tr><th>Benutzer</th><th>Zuletzt angemeldet</th><th>Rolle</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <h3 class="h6">Benutzer vorab anlegen</h3>
    <p class="text-muted small">Zum Beispiel, um jemandem schon vor der ersten Anmeldung Admin-Rechte zu geben.
      Der Benutzername muss genau dem Anmeldenamen aus dem SSO entsprechen.</p>
    <form id="user-form" class="row g-2 align-items-end" novalidate>
      <div class="col-md-5"><label class="form-label small" for="u-name">Benutzername</label>
        <input class="form-control" id="u-name" name="username" placeholder="vorname.nachname@…" required></div>
      <div class="col-md-4"><label class="form-label small" for="u-display">Anzeigename</label>
        <input class="form-control" id="u-display" name="display_name"></div>
      <div class="col-md-3"><div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="u-admin" name="is_admin" checked>
        <label class="form-check-label" for="u-admin">Admin</label></div></div>
      <div class="col-12"><button class="btn btn-primary" type="submit">Benutzer anlegen</button></div>
    </form>`;

  document.getElementById("user-form").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const body = { username: f.username.value.trim(), display_name: f.display_name.value.trim(), is_admin: f.is_admin.checked };
    if (!body.username) return notify("Bitte einen Benutzernamen eintragen.", "warning");
    try { await api("/api/users", { method: "POST", body }); notify("Benutzer angelegt."); usersView(); }
    catch (err) { notify(err.message, "danger"); }
  });
}

/* ---------- Auswahl & Ereignisse ---------- */
async function select(sel) {
  selection = sel;
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  renderTree();
  if (!sel) return;
  if (sel.type === "team") teamForm(teams.find(t => t.id === sel.id));
  if (sel.type === "app") {
    try { appForm(await api(`/api/apps/${sel.id}`)); } catch (err) { notify(err.message, "danger"); }
  }
}

async function reload(sel) {
  teams = await api("/api/teams");
  if (!sel) document.getElementById("editor").innerHTML =
    `<div class="p-empty border-0"><i class="bi bi-hand-index"></i>Wähle links ein Team oder eine Anwendung aus.</div>`;
  await select(sel);
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-team]");
  if (t) return select({ type: "team", id: Number(t.dataset.team) });
  const a = e.target.closest("[data-app]");
  if (a) return select({ type: "app", id: Number(a.dataset.app) });
  const n = e.target.closest("[data-new-app]");
  if (n) {
    selection = null; renderTree();
    return appForm({ team_id: Number(n.dataset.newApp), name: "", description: "", icon: "app", color: "green",
      url: "", contact: "", sort_order: 99, is_placeholder: false, api_base_url: "", api_auth: "",
      api_spec_url: "", api_notes: "", endpoints: [], tech_stack: [], integrations: [] });
  }
  const add = e.target.closest("[data-add]");
  if (add) {
    const key = add.dataset.add;
    document.querySelector(`[data-rows="${key}"]`).insertAdjacentHTML("beforeend", rowTemplates[key]());
    return;
  }
  const rm = e.target.closest("[data-remove]");
  if (rm) rm.closest("[data-row]").remove();
});

document.addEventListener("change", async e => {
  const sw = e.target.closest("[data-admin]");
  if (!sw) return;
  const id = Number(sw.dataset.admin);
  try {
    await api(`/api/users/${id}`, { method: "PATCH", body: { is_admin: sw.checked } });
    notify(sw.checked ? "Admin-Recht vergeben." : "Admin-Recht entzogen.");
    if (id === ME.user?.id && !sw.checked) location.href = "/";   // eigene Rechte abgegeben
  } catch (err) { sw.checked = !sw.checked; notify(err.message, "danger"); }
});

document.addEventListener("click", async e => {
  const del = e.target.closest("[data-del-user]");
  if (!del) return;
  if (!confirm(`${del.dataset.name} entfernen? Die Favoriten dieser Person werden gelöscht.`)) return;
  try { await api(`/api/users/${del.dataset.delUser}`, { method: "DELETE" }); notify("Benutzer entfernt."); usersView(); }
  catch (err) { notify(err.message, "danger"); }
});

document.addEventListener("input", e => {
  if (e.target.matches("[data-icon-input]") && document.getElementById("icon-preview"))
    document.getElementById("icon-preview").className = `bi bi-${e.target.value.trim()}`;
});

document.getElementById("show-users").addEventListener("click", usersView);

document.getElementById("new-team").addEventListener("click", () => {
  selection = null; renderTree();
  teamForm({ name: "", subtitle: "", icon: "folder", sort_order: teams.length + 1, applications: [] });
});

(async function init() {
  await loadMe();
  renderChrome("");
  if (!isAdmin()) {
    const box = document.getElementById("no-access");
    box.hidden = false;
    box.innerHTML = `<div class="p-empty"><i class="bi bi-lock"></i>
      ${isLoggedIn()
        ? `Du hast Lesezugriff. Änderungen an Teams und Anwendungen können nur Admins vornehmen.`
        : `Bitte melde dich an. Änderungen können nur Admins vornehmen.`}
      <div><a href="mailto:${esc(PORTAL.contactMail)}">Admin-Rechte anfragen</a></div></div>`;
    return;
  }
  document.getElementById("admin-actions").hidden = false;
  document.getElementById("workspace").hidden = false;
  try {
    teams = await api("/api/teams");
    const slug = new URLSearchParams(location.search).get("app");
    const app = slug && teams.flatMap(t => t.applications).find(a => a.slug === slug);
    if (location.hash === "#benutzer") await usersView();
    else await select(app ? { type: "app", id: app.id } : null);
    renderTree();
  } catch (err) { notify(`Daten konnten nicht geladen werden: ${err.message}`, "danger"); }
})();

window.addEventListener("hashchange", () => { if (location.hash === "#benutzer" && isAdmin()) usersView(); });
