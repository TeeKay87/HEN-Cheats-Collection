const DATA_URL = "./cheatslist.json";

/* ---------- DOM ---------- */

const elGrid  = document.getElementById("grid");
const elEmpty = document.getElementById("empty");
const elQ     = document.getElementById("q");
const elClear = document.getElementById("clear");
const elCount = document.getElementById("count");
const elTotal = document.getElementById("total");

// Modal
const elModal     = document.getElementById("modal");
const elMClose    = document.getElementById("m_close");
const elMID       = document.getElementById("m_id");
const elMTitle    = document.getElementById("m_title");
const elMMeta     = document.getElementById("m_meta");
const elMBadges   = document.getElementById("m_badges");
const elMCreators = document.getElementById("m_creators");
const elMLists    = document.getElementById("m_lists");
const elMQ        = document.getElementById("m_q");
const elMClear    = document.getElementById("m_clear");

/* ---------- State ---------- */

let all = [];
let current = null;
let byKey = new Map(); // "ID|VERSION" -> item

/* ---------- Small helpers ---------- */

function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function safeHtml(text) {
  return (text ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeKey(item) {
  const id = (item?.id ?? "").trim();
  const v  = (item?.version ?? "").trim();
  return `${id}|${v}`;
}

function hashFor(item) {
  // Keep it readable: #CUSA12345-01.00
  const id = (item?.id ?? "").trim();
  const v  = (item?.version ?? "").trim();
  return `#${encodeURIComponent(id)}-${encodeURIComponent(v)}`;
}

function parseHash() {
  // Expected: #ID-VERSION
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return null;

  // Split on the last '-' just to be safe.
  const idx = h.lastIndexOf("-");
  if (idx <= 0 || idx >= h.length - 1) return null;

  const id = decodeURIComponent(h.slice(0, idx)).trim();
  const v  = decodeURIComponent(h.slice(idx + 1)).trim();
  if (!id || !v) return null;

  return `${id}|${v}`;
}

function ledClass(hasFile, cheatsCount) {
  if (hasFile) return "good";
  if (cheatsCount > 0) return "warn";
  return "";
}

function hasCheats(fmt) {
  const cnt = Number(fmt?.cheatsCount ?? 0);
  if (cnt > 0) return true;
  return Array.isArray(fmt?.cheats) && fmt.cheats.length > 0;
}

function badgeHtml(label, fmt) {
  const hasFile = !!fmt?.hasFile;
  const cnt = Number(fmt?.cheatsCount ?? 0);
  const led = ledClass(hasFile, cnt);

  return `
    <div class="badge" title="${label}: ${hasFile ? "file available" : "no file"} • ${cnt} cheat(s)">
      <span class="led ${led}"></span>
      <span class="b">${label}</span>
      <span>${cnt}</span>
    </div>
  `;
}

function getCreatorsHaystack(item) {
  // creatorsLower can be an array or a string depending on your generator
  if (Array.isArray(item?.creatorsLower)) return norm(item.creatorsLower.join(" "));
  if (typeof item?.creatorsLower === "string") return norm(item.creatorsLower);

  if (Array.isArray(item?.creators)) {
    return norm(item.creators.map(c => (c ?? "").toString()).join(" "));
  }

  return "";
}

function getUniqueCreators(item) {
  const creators = Array.isArray(item?.creators) ? item.creators : [];
  const uniq = new Map(); // lower -> original

  for (const c of creators) {
    const v = (c ?? "").toString().trim();
    if (!v) continue;

    const k = v.toLowerCase();
    if (!uniq.has(k)) uniq.set(k, v);
  }

  return [...uniq.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

/* ---------- Rendering: list ---------- */

function cardHtml(item) {
  const id = item.id ?? "";
  const version = item.version ?? "";
  const title = item.title ?? "";
  const total = Number(item.cheatsTotal ?? 0);
  const f = item.formats ?? {};

  const badges = [];
  if (hasCheats(f.json)) badges.push(badgeHtml("json", f.json));
  if (hasCheats(f.shn))  badges.push(badgeHtml("shn",  f.shn));
  if (hasCheats(f.mc4))  badges.push(badgeHtml("mc4",  f.mc4));

  return `
    <article class="card" data-idx="${item.__idx}">
      <div class="top">
        <div>
          <div class="id">
            <span>${safeHtml(id)}</span>
            <span class="tag">v${safeHtml(version)}</span>
            <span class="tag">${total} cheats</span>
          </div>
          <div class="name">${safeHtml(title)}</div>
        </div>

        ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
      </div>
    </article>
  `;
}

function render(items) {
  elGrid.innerHTML = items.map(cardHtml).join("");
  elCount.textContent = String(items.length);
  elTotal.textContent = String(all.length);
  elEmpty.style.display = items.length ? "none" : "block";
}

function applyFilter() {
  const q = norm(elQ.value);
  if (!q) {
    render(all);
    return;
  }

  const filtered = all.filter(x => {
    const id = x.idLower ? norm(x.idLower) : norm(x.id);
    const title = x.titleLower ? norm(x.titleLower) : norm(x.title);
    const creators = getCreatorsHaystack(x);

    return id.includes(q) || title.includes(q) || creators.includes(q);
  });

  render(filtered);
}

/* ---------- Rendering: modal ---------- */

function renderModalLists(filterText) {
  if (!current) {
    elMLists.innerHTML = "";
    return;
  }

  const q = norm(filterText);

  const formats = [
    ["json", current.formats?.json],
    ["shn",  current.formats?.shn],
    ["mc4",  current.formats?.mc4],
  ].map(([key, obj]) => ({
    key,
    cheats: Array.isArray(obj?.cheats) ? obj.cheats : []
  }));

  // Apply cheat-name filter inside the modal, then keep only non-empty formats.
  let filtered = formats.map(f => ({
    ...f,
    cheats: q ? f.cheats.filter(c => norm(c).includes(q)) : f.cheats
  })).filter(f => f.cheats.length > 0);

  if (!q && filtered.length === 0) {
    elMLists.innerHTML = `
      <div class="section">
        <div class="section__head">
          <div class="section__title">No cheats available</div>
          <div class="section__count">0</div>
        </div>
        <div class="section__body">
          <div class="muted-note">This entry has no cheats to display.</div>
        </div>
      </div>
    `;
    return;
  }

  const sectionHtml = (label, items) => `
    <div class="section">
      <div class="section__head">
        <div class="section__title">${safeHtml(`${label.toUpperCase()} cheats`)}</div>
        <div class="section__count">${items.length}</div>
      </div>
      <div class="section__body">
        <ol class="cheats">
          ${items.map(x => `<li>${safeHtml(x)}</li>`).join("")}
        </ol>
      </div>
    </div>
  `;

  const totalMatches = filtered.reduce((sum, f) => sum + f.cheats.length, 0);
  if (q && totalMatches === 0) {
    elMLists.innerHTML = `
      <div class="section">
        <div class="section__head">
          <div class="section__title">No matches</div>
          <div class="section__count">0</div>
        </div>
        <div class="section__body">
          <div class="muted-note">Try a different keyword.</div>
        </div>
      </div>
    `;
    return;
  }

  elMLists.innerHTML = filtered.map(f => sectionHtml(f.key, f.cheats)).join("");
}

function openModal(item, { setHash = true } = {}) {
  current = item;

  elMID.textContent = `${item.id ?? ""}  •  v${item.version ?? ""}`;
  elMTitle.textContent = item.title ?? "";

  const total = Number(item.cheatsTotal ?? 0);
  elMMeta.innerHTML = `
    <span><span class="kbd">Total</span> ${total} cheats</span>
    <span class="dot">•</span>
    <span><span class="kbd">ID</span> ${safeHtml(item.id ?? "")}</span>
    <span class="dot">•</span>
    <span><span class="kbd">Version</span> ${safeHtml(item.version ?? "")}</span>
  `;

  // Badges: show only formats that actually have cheats.
  const f = item.formats ?? {};
  const badges = [];
  if (hasCheats(f.json)) badges.push(badgeHtml("json", f.json));
  if (hasCheats(f.shn))  badges.push(badgeHtml("shn",  f.shn));
  if (hasCheats(f.mc4))  badges.push(badgeHtml("mc4",  f.mc4));

  elMBadges.innerHTML = badges.join("");
  elMBadges.style.display = badges.length ? "" : "none";

  // Creators: unique, stable order.
  const creators = getUniqueCreators(item);
  if (creators.length) {
    elMCreators.style.display = "";
    elMCreators.innerHTML =
      `<span class="label">Creators:</span>` +
      creators.map(x => `<span class="creator-chip">${safeHtml(x)}</span>`).join("");
  } else {
    elMCreators.style.display = "none";
    elMCreators.innerHTML = "";
  }

  elMQ.value = "";
  renderModalLists("");

  elModal.classList.add("is-open");
  elModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  if (setHash) {
    const h = hashFor(item);
    if (location.hash !== h) history.pushState(null, "", h);
  }

  // Let the modal paint before focusing (prevents some mobile oddities).
  setTimeout(() => elMQ.focus(), 0);
}

function closeModal({ clearHash = true } = {}) {
  elModal.classList.remove("is-open");
  elModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  current = null;

  if (clearHash && location.hash) {
    history.pushState(null, "", location.pathname + location.search);
  }
}

function openFromHash() {
  const key = parseHash();
  if (!key) return false;

  const item = byKey.get(key);
  if (!item) return false;

  openModal(item, { setHash: false });
  return true;
}

/* ---------- Boot ---------- */

async function boot() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    all = Array.isArray(data) ? data : (Array.isArray(data?.entries) ? data.entries : []);

    all.sort((a, b) => {
      const t = (a.titleLower ?? a.title ?? "").localeCompare((b.titleLower ?? b.title ?? ""), "en", { sensitivity: "base" });
      if (t) return t;
      const i = (a.id ?? "").localeCompare((b.id ?? ""), "en", { sensitivity: "base" });
      if (i) return i;
      return (a.version ?? "").localeCompare((b.version ?? ""), "en", { sensitivity: "base" });
    });
    
    // Assign stable indices AFTER sorting
    all.forEach((item, i) => { item.__idx = i; });

    byKey = new Map();
    for (const item of all) byKey.set(makeKey(item), item);

    render(all);
    openFromHash();
  } catch (err) {
    elGrid.innerHTML = `
      <div class="empty">
        <b>Failed to load data.</b><br/>
        Make sure <span class="kbd">${safeHtml(DATA_URL)}</span> is in the same folder as index.html.<br/><br/>
        Error: <span class="kbd">${safeHtml(String(err))}</span>
      </div>
    `;
  }
}

/* ---------- Events ---------- */

elQ.addEventListener("input", applyFilter);

elClear.addEventListener("click", () => {
  elQ.value = "";
  applyFilter();
  elQ.focus();
});

// Card click (event delegation)
elGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;

  const idx = Number(card.getAttribute("data-idx"));
  const item = all[idx];
  if (item) openModal(item, { setHash: true });
});

// Modal close handlers
elModal.addEventListener("click", (e) => {
  if (e.target && e.target.hasAttribute("data-close")) closeModal({ clearHash: true });
});

elMClose.addEventListener("click", () => closeModal({ clearHash: true }));

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && elModal.classList.contains("is-open")) closeModal({ clearHash: true });
});

// Modal filter
elMQ.addEventListener("input", () => renderModalLists(elMQ.value));

elMClear.addEventListener("click", () => {
  elMQ.value = "";
  renderModalLists("");
  elMQ.focus();
});

// React to manual hash changes / browser back-forward
window.addEventListener("hashchange", () => {
  const key = parseHash();

  if (!key) {
    if (elModal.classList.contains("is-open")) closeModal({ clearHash: false });
    return;
  }

  const item = byKey.get(key);
  if (!item) return;

  const curKey = current ? makeKey(current) : "";
  if (!elModal.classList.contains("is-open") || curKey !== key) {
    openModal(item, { setHash: false });
  }
});

boot();
