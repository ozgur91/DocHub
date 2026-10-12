/* Detailseite einer Anwendung: Überblick, API, Techstack, Verknüpfungen */
const SECTIONS = [
  { id: "ueberblick", label: "Überblick", icon: "info-circle" },
  { id: "api", label: "API", icon: "code-slash" },
  { id: "techstack", label: "Techstack", icon: "stack" },
  { id: "verknuepfungen", label: "API-Verknüpfungen", icon: "link-45deg" },
];
const STACK_ORDER = ["Frontend", "Backend", "Datenbank", "Infrastruktur", "Sonstiges"];
const DIRECTION = { in: "empfängt", out: "sendet", both: "beidseitig" };
let app = null;

const link = url => isLink(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>` : (esc(url) || "–");
const empty = (icon, text) => `<div class="p-empty"><i class="bi bi-${icon}"></i>${text}
  ${isAdmin() ? `<div><a href="/pflege.html?app=${encodeURIComponent(app.slug)}">Jetzt ergänzen</a></div>` : ""}</div>`;

function overview() {
  return `<div class="p-panel"><dl class="p-dl">
    <dt>Beschreibung</dt><dd>${esc(app.description) || "–"}</dd>
    <dt>Team</dt><dd>${esc(app.team_name)}</dd>
    <dt>Adresse</dt><dd>${link(app.url)}</dd>
    <dt>Ansprechpartner</dt><dd>${app.contact.includes("@") ? `<a href="mailto:${esc(app.contact)}">${esc(app.contact)}</a>` : esc(app.contact) || "–"}</dd>
  </dl></div>`;
}

function apiSection() {
  const hasInfo = app.api_base_url || app.api_auth || app.api_spec_url || app.api_notes;
  if (!hasInfo && !app.endpoints.length) return empty("code-slash", "Für diese Anwendung ist noch keine API dokumentiert.");
  const rows = app.endpoints.map(e => `
    <tr><td><span class="p-method m-${esc(e.method.toUpperCase())}">${esc(e.method.toUpperCase())}</span></td>
        <td><code>${esc(e.path)}</code></td><td>${esc(e.description)}</td></tr>`).join("");
  return `
    <div class="p-panel mb-4"><dl class="p-dl">
      <dt>Basis-URL</dt><dd>${app.api_base_url ? `<code>${esc(app.api_base_url)}</code>` : "–"}</dd>
      <dt>Authentifizierung</dt><dd>${esc(app.api_auth) || "–"}</dd>
      <dt>Spezifikation</dt><dd>${link(app.api_spec_url)}</dd>
      ${app.api_notes ? `<dt>Hinweise</dt><dd style="white-space:pre-line">${esc(app.api_notes)}</dd>` : ""}
    </dl></div>
    ${app.endpoints.length ? `
      <h2 class="h6 mb-3">Endpunkte</h2>
      <div class="p-panel p-0 overflow-auto"><table class="table p-table">
        <thead><tr><th style="width:6rem">Methode</th><th>Pfad</th><th>Beschreibung</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : ""}`;
}

function stackSection() {
  if (!app.tech_stack.length) return empty("stack", "Der Techstack ist noch nicht hinterlegt.");
  const groups = {};
  app.tech_stack.forEach(t => (groups[t.category] ||= []).push(t));
  const cats = Object.keys(groups).sort((a, b) =>
    (STACK_ORDER.indexOf(a) + 1 || 99) - (STACK_ORDER.indexOf(b) + 1 || 99));
  return `<div class="p-panel"><div class="row g-4">${cats.map(c => `
    <div class="col-md-6 p-stack-group"><h3>${esc(c)}</h3>
      ${groups[c].map(t => `<span class="p-chip">${esc(t.name)}${t.version ? `<small>${esc(t.version)}</small>` : ""}</span>`).join("")}
    </div>`).join("")}</div></div>`;
}

function linksSection() {
  if (!app.integrations.length) return empty("link-45deg", "Es sind noch keine Verknüpfungen zu anderen Systemen erfasst.");
  const node = i => `<div class="p-node"><i class="bi bi-${i.direction === "both" ? "arrow-left-right" : "box"}"></i>${esc(i.target)}<small>${esc(i.protocol)}</small></div>`;
  const incoming = app.integrations.filter(i => i.direction !== "out");
  const outgoing = app.integrations.filter(i => i.direction !== "in");
  const col = (title, list) => `<div class="p-flow-col"><h3>${title}</h3>
    ${list.length ? list.map(node).join("") : `<div class="p-flow-empty">Keine</div>`}</div>`;
  const rows = app.integrations.map(i => `
    <tr><td class="fw-semibold">${esc(i.target)}</td><td>${DIRECTION[i.direction] || esc(i.direction)}</td>
        <td>${esc(i.protocol) || "–"}</td><td>${esc(i.description)}</td></tr>`).join("");
  return `
    <div class="p-panel mb-4">
      <div class="p-flow">
        ${col("Daten kommen von", incoming)}
        <div class="p-flow-center">${appIcon(app)}${esc(app.name)}</div>
        ${col("Daten gehen an", outgoing)}
      </div>
    </div>
    <div class="p-panel p-0 overflow-auto"><table class="table p-table">
      <thead><tr><th>System</th><th>Richtung</th><th>Protokoll</th><th>Zweck</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

const RENDER = { ueberblick: overview, api: apiSection, techstack: stackSection, verknuepfungen: linksSection };

function render() {
  const current = SECTIONS.some(s => "#" + s.id === location.hash) ? location.hash.slice(1) : "ueberblick";
  const label = SECTIONS.find(s => s.id === current).label;
  document.title = `${app.name} – ${label} – ${PORTAL.name}`;
  document.getElementById("detail").innerHTML = `
    <nav aria-label="Brotkrumen" class="mb-4"><ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="/">Anwendungen</a></li>
      <li class="breadcrumb-item"><a href="/">${esc(app.team_name)}</a></li>
      <li class="breadcrumb-item active" aria-current="page">${esc(app.name)}</li></ol></nav>

    <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
      ${appIcon(app, "lg")}
      <div class="flex-grow-1"><h1 class="h3 mb-0">${esc(app.name)}</h1>
        <span class="text-muted">${esc(app.team_name)}</span></div>
      ${isAdmin() ? `<a class="btn btn-outline-primary" href="/pflege.html?app=${encodeURIComponent(app.slug)}"><i class="bi bi-pencil me-1"></i>Bearbeiten</a>` : ""}
      ${isLink(app.url) ? `<a class="btn btn-primary" href="${esc(app.url)}" target="_blank" rel="noopener">
        <i class="bi bi-rocket-takeoff me-1"></i>Anwendung öffnen</a>` : ""}
    </div>

    <ul class="nav p-tabs mb-4">${SECTIONS.map(s => `
      <li class="nav-item"><a class="nav-link ${s.id === current ? "active" : ""}" href="#${s.id}"
        ${s.id === current ? 'aria-current="page"' : ""}><i class="bi bi-${s.icon} me-1"></i>${s.label}</a></li>`).join("")}
    </ul>
    <section>${RENDER[current]()}</section>`;
}

(async function init() {
  await loadMe();
  renderChrome("apps");
  const slug = new URLSearchParams(location.search).get("app");
  try {
    if (!slug) throw new Error("Keine Anwendung angegeben");
    app = await api(`/api/apps/${encodeURIComponent(slug)}`);
    render();
    window.addEventListener("hashchange", render);
  } catch (err) {
    document.getElementById("detail").innerHTML = `<div class="p-empty"><i class="bi bi-exclamation-triangle"></i>
      ${esc(err.message)}.<div><a href="/">Zurück zur Übersicht</a></div></div>`;
  }
})();
