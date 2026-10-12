/* Gemeinsame Hilfsfunktionen für alle Seiten */

// Texte – hier zentral anpassbar
const PORTAL = {
  name: "DocHub",
  department: "Dokumentenmanagement",
  organisation: "AOK Rheinland/Hamburg",
  contactMail: "dokumentenmanagement@intern.example",
};

const COLORS = ["green", "teal", "blue", "red", "amber", "violet", "gray"];

/* ---------- API ---------- */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let msg = `Fehler ${res.status}`;
    try { const j = await res.json(); if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- HTML-Helfer ---------- */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function appIcon(app, size = "") {
  const color = COLORS.includes(app.color) ? app.color : "gray";
  return `<span class="p-app-icon c-${color} ${size}"><i class="bi bi-${esc(app.icon || "app")}"></i></span>`;
}
function isLink(url) { return /^https?:\/\//i.test(url || ""); }

/* ---------- Angemeldeter Benutzer & Favoriten (serverseitig pro Benutzer) ---------- */
let ME = { authenticated: false, user: null, favorites: [] };

async function loadMe() {
  try { ME = await api("/api/me"); } catch { ME = { authenticated: false, user: null, favorites: [] }; }
  return ME;
}
const isLoggedIn = () => !!ME.authenticated;
const isAdmin = () => !!ME.user?.is_admin;
function getFavorites() { return ME.favorites || []; }
function isFavorite(slug) { return getFavorites().includes(slug); }
async function toggleFavorite(slug) {
  const method = isFavorite(slug) ? "DELETE" : "PUT";
  ME.favorites = await api(`/api/me/favorites/${encodeURIComponent(slug)}`, { method });
  return isFavorite(slug);
}
function initials(name) {
  const parts = String(name || "?").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/* ---------- Kopf- und Fußzeile ---------- */
function userMenu() {
  if (!isLoggedIn()) return `<span class="p-avatar is-anon ms-2" title="Nicht angemeldet"><i class="bi bi-person"></i></span>`;
  const u = ME.user;
  return `
    <div class="dropdown ms-2">
      <button class="p-avatar" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Benutzermenü: ${esc(u.display_name)}">
        ${esc(initials(u.display_name || u.username))}</button>
      <div class="dropdown-menu dropdown-menu-end p-user-menu">
        <div class="px-3 py-2">
          <strong class="d-block">${esc(u.display_name)}</strong>
          <small class="text-muted d-block">${esc(u.username)}</small>
          <span class="p-count ${u.is_admin ? "" : "neutral"} ms-0 mt-2">${u.is_admin ? "Admin" : "Lesezugriff"}</span>
        </div>
        <div class="dropdown-divider"></div>
        <a class="dropdown-item" href="/#favoriten"><i class="bi bi-star me-2"></i>Meine Favoriten</a>
        ${u.is_admin ? `<a class="dropdown-item" href="/pflege.html"><i class="bi bi-pencil-square me-2"></i>Anwendungen pflegen</a>
        <a class="dropdown-item" href="/pflege.html#benutzer"><i class="bi bi-people me-2"></i>Benutzer & Rechte</a>` : ""}
      </div>
    </div>`;
}

function renderChrome(active) {
  const header = document.getElementById("site-header");
  if (header) header.innerHTML = `
    <header class="p-header">
      <div class="container d-flex align-items-center justify-content-between gap-3">
        <a class="p-brand" href="/">
          <span class="p-brand-mark"><i class="bi bi-diagram-3"></i></span>
          <span class="p-brand-text"><strong>${esc(PORTAL.name)}</strong><span>${esc(PORTAL.department)}, ${esc(PORTAL.organisation)}</span></span>
        </a>
        <nav class="p-nav" aria-label="Hauptnavigation">
          <a href="/" class="${active === "apps" ? "active" : ""}"><i class="bi bi-grid"></i><span>Anwendungen</span></a>
          <a href="/#favoriten" class="${active === "favs" ? "active" : ""}"><i class="bi bi-star"></i><span>Meine Favoriten</span></a>
        </nav>
        <div class="d-flex align-items-center gap-1">
          ${isAdmin() ? `<a class="p-icon-btn" href="/pflege.html" title="Anwendungen pflegen" aria-label="Anwendungen pflegen"><i class="bi bi-pencil-square"></i></a>` : ""}
          <a class="p-icon-btn" href="/docs" title="Schnittstelle von ${esc(PORTAL.name)}" aria-label="Schnittstelle von ${esc(PORTAL.name)}"><i class="bi bi-question-circle"></i></a>
          ${userMenu()}
        </div>
      </div>
    </header>`;
  const footer = document.getElementById("site-footer");
  if (footer) footer.innerHTML = `
    <footer class="p-footer">
      <div class="container d-flex flex-wrap justify-content-between gap-2 border-top pt-4">
        <span><i class="bi bi-shield-check me-2"></i>Ein Bereich der ${esc(PORTAL.organisation)}</span>
        <a href="mailto:${esc(PORTAL.contactMail)}">Fragen? <i class="bi bi-arrow-right ms-1"></i></a>
      </div>
    </footer>`;
}
