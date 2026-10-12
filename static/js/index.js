/* Startseite: Teams, Kacheln, Suche, Favoriten, Detail-Dialog */
let teams = [];
let activeTeam = "alle";
let query = "";
const modal = new bootstrap.Modal(document.getElementById("app-modal"));

function tileHTML(app) {
  if (app.is_placeholder) {
    return `
      <button type="button" class="p-tile is-placeholder" data-slug="${esc(app.slug)}">
        <span class="p-ph-badge">Platzhalter</span>
        ${appIcon({ ...app, color: "gray" })}
        <h3>${esc(app.name)}</h3>
        <span class="p-tile-sub">Noch nicht belegt</span>
        <i class="bi bi-arrow-up-right p-tile-arrow"></i>
      </button>`;
  }
  const fav = isFavorite(app.slug);
  const star = isLoggedIn() ? `
      <button type="button" class="p-star ${fav ? "on" : ""}" data-fav="${esc(app.slug)}"
        aria-pressed="${fav}" aria-label="${esc(app.name)} ${fav ? "aus Favoriten entfernen" : "zu Favoriten hinzufügen"}">
        <i class="bi bi-star${fav ? "-fill" : ""}"></i>
      </button>` : "";
  return `
    <div class="position-relative h-100">${star}
      <button type="button" class="p-tile" data-slug="${esc(app.slug)}">
        ${appIcon(app)}
        <h3>${esc(app.name)}</h3>
        <span class="p-tile-sub">Anwendung öffnen</span>
        <i class="bi bi-arrow-up-right p-tile-arrow"></i>
      </button>
    </div>`;
}

function matches(app) {
  if (!query) return true;
  const hay = `${app.name} ${app.description}`.toLowerCase();
  return hay.includes(query);
}

function renderTabs() {
  const tabs = [{ slug: "alle", name: "Alle Teams", count: teams.length }, ...teams.map(t => ({ slug: t.slug, name: t.name }))];
  document.getElementById("team-tabs").innerHTML = tabs.map(t => `
    <li class="nav-item" role="presentation">
      <button class="nav-link ${t.slug === activeTeam ? "active" : ""}" data-team="${esc(t.slug)}" role="tab"
        aria-selected="${t.slug === activeTeam}">${esc(t.name)}${t.count != null ? `<span class="p-count">${t.count}</span>` : ""}</button>
    </li>`).join("");
  document.getElementById("team-total").textContent = teams.length;
}

function renderSections() {
  const visibleTeams = teams.filter(t => activeTeam === "alle" || t.slug === activeTeam);
  const blocks = visibleTeams.map(team => {
    const apps = team.applications.filter(matches);
    if (query && !apps.length) return null;
    // Große Teams nehmen die volle Breite, kleine (bis 2 Kacheln) teilen sich eine Zeile
    const wide = activeTeam !== "alle" || team.applications.length > 2;
    const cols = wide ? "row-cols-1 row-cols-sm-2 row-cols-lg-4 row-cols-xl-5" : "row-cols-1 row-cols-sm-2";
    return { wide, html: `
      <section class="${wide ? "col-12" : "col-12 col-lg-6"} mb-2" aria-labelledby="team-${esc(team.slug)}">
        <div class="p-team-head">
          <span class="p-team-icon"><i class="bi bi-${esc(team.icon)}"></i></span>
          <div class="flex-grow-1">
            <h2 id="team-${esc(team.slug)}">${esc(team.name)}</h2>
            <p>${esc(team.subtitle)}</p>
          </div>
          <span class="p-count neutral">${team.applications.length}</span>
        </div>
        ${apps.length
          ? `<div class="row ${cols} g-3">${apps.map(a => `<div class="col">${tileHTML(a)}</div>`).join("")}</div>`
          : `<div class="p-empty"><i class="bi bi-plus-square-dotted"></i>Noch keine Anwendungen in diesem Team.
               ${isAdmin() ? `<div><a href="/pflege.html">Anwendung hinzufügen</a></div>` : ""}</div>`}
      </section>` };
  }).filter(Boolean);

  // Trennlinie nach jeder "vollen Zeile"
  let html = "", halfOpen = false;
  blocks.forEach((b, i) => {
    if (i > 0 && (b.wide || !halfOpen)) html += `<div class="col-12"><div class="p-divider"></div></div>`;
    html += b.html;
    halfOpen = !b.wide && !halfOpen;
  });
  document.getElementById("team-sections").innerHTML = html || `
    <div class="col-12"><div class="p-empty"><i class="bi bi-search"></i>Keine Anwendung zu „${esc(query)}“ gefunden.</div></div>`;
}

function renderFavorites() {
  const favs = getFavorites();
  const apps = teams.flatMap(t => t.applications).filter(a => favs.includes(a.slug));
  document.getElementById("fav-grid").innerHTML = apps.length
    ? apps.map(a => `<div class="col">${tileHTML(a)}</div>`).join("")
    : `<div class="col-12 w-100"><div class="p-empty"><i class="bi bi-star"></i>
         ${isLoggedIn()
           ? "Noch keine Favoriten. Markiere eine Anwendung mit dem Stern, um sie hier zu sammeln."
           : "Melde dich an, um Favoriten zu speichern."}
         <div><a href="/">Zu allen Anwendungen</a></div></div></div>`;
}

function showView() {
  const favs = location.hash === "#favoriten";
  document.getElementById("view-apps").hidden = favs;
  document.getElementById("view-favs").hidden = !favs;
  renderChrome(favs ? "favs" : "apps");
  favs ? renderFavorites() : renderSections();
}

/* ---------- Detail-Dialog ---------- */
function openApp(slug) {
  const app = teams.flatMap(t => t.applications.map(a => ({ ...a, team: t }))).find(a => a.slug === slug);
  if (!app) return;
  const body = document.getElementById("app-modal-body");
  const detail = section => `/app.html?app=${encodeURIComponent(app.slug)}#${section}`;

  const actions = app.is_placeholder
    ? (isAdmin()
        ? `<p class="text-muted">Dieser Platz ist noch frei. Trage hier eine Anwendung des Teams ein.</p>
           <a class="p-action" href="/pflege.html?app=${encodeURIComponent(app.slug)}"><i class="bi bi-pencil"></i>Platz belegen<i class="bi bi-arrow-right"></i></a>`
        : `<p class="text-muted">Dieser Platz ist noch frei. Hier kommt bald eine weitere Anwendung des Teams hin.</p>`)
    : `
      <a class="p-action ${isLink(app.url) ? "" : "disabled"}" href="${esc(app.url)}" target="_blank" rel="noopener">
        <i class="bi bi-rocket-takeoff"></i>Absprung in die App<i class="bi bi-arrow-right"></i></a>
      <a class="p-action" href="${detail("api")}"><i class="bi bi-code-slash"></i>API<i class="bi bi-arrow-right"></i></a>
      <a class="p-action" href="${detail("techstack")}"><i class="bi bi-stack"></i>Techstack<i class="bi bi-arrow-right"></i></a>
      <a class="p-action" href="${detail("verknuepfungen")}"><i class="bi bi-link-45deg"></i>API-Verknüpfung<i class="bi bi-arrow-right"></i></a>`;

  body.innerHTML = `
    <div class="d-flex justify-content-between align-items-start">
      ${appIcon(app.is_placeholder ? { ...app, color: "gray" } : app, "lg")}
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schließen"></button>
    </div>
    <h2 class="modal-title" id="app-modal-title">${esc(app.name)}</h2>
    <p class="text-muted mb-4">${esc(app.team.name)}</p>
    ${actions}
    <button type="button" class="btn btn-primary w-100 py-2 mt-3" data-bs-dismiss="modal">
      Zurück zur Übersicht <i class="bi bi-arrow-right ms-1"></i></button>`;
  modal.show();
}

/* ---------- Ereignisse ---------- */
document.addEventListener("click", e => {
  const star = e.target.closest("[data-fav]");
  if (star) {
    star.disabled = true;
    toggleFavorite(star.dataset.fav)
      .then(showView)
      .catch(err => { star.disabled = false; alert(`Favorit konnte nicht gespeichert werden: ${err.message}`); });
    return;
  }
  const tile = e.target.closest(".p-tile[data-slug]");
  if (tile) { openApp(tile.dataset.slug); return; }
  const tab = e.target.closest("[data-team]");
  if (tab) { activeTeam = tab.dataset.team; renderTabs(); renderSections(); }
});
document.getElementById("search").addEventListener("input", e => {
  query = e.target.value.trim().toLowerCase();
  renderSections();
});
window.addEventListener("hashchange", showView);

(async function init() {
  await loadMe();
  renderChrome("apps");
  try {
    teams = await api("/api/teams");
    renderTabs();
    showView();
  } catch (err) {
    document.getElementById("team-sections").innerHTML =
      `<div class="col-12"><div class="p-empty"><i class="bi bi-exclamation-triangle"></i>
       Die Anwendungen konnten nicht geladen werden (${esc(err.message)}). Läuft das Backend?</div></div>`;
  }
})();
