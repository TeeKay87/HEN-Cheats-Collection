const DATA_URL = "./cheatslist.json";

const elGrid  = document.getElementById("grid");
const elEmpty = document.getElementById("empty");
const elQ     = document.getElementById("q");
const elClear = document.getElementById("clear");
const elCount = document.getElementById("count");
const elTotal = document.getElementById("total");

// Modal
const elModal   = document.getElementById("modal");
const elMClose  = document.getElementById("m_close");
const elMID     = document.getElementById("m_id");
const elMTitle  = document.getElementById("m_title");
const elMMeta   = document.getElementById("m_meta");
const elMBadges = document.getElementById("m_badges");
const elMLists  = document.getElementById("m_lists");
const elMQ      = document.getElementById("m_q");
const elMClear  = document.getElementById("m_clear");

let all = [];
let current = null;
let byKey = new Map(); // "ID|VERSION" -> item

function norm(s){
  return (s ?? "").toString().trim().toLowerCase();
}

function safeHtml(text){
  return (text ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ledClass(hasFile, cheatsCount){
  if (hasFile) return "good";
  if (cheatsCount > 0) return "warn";
  return "";
}

function badgeHtml(label, fmt){
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

function makeKey(item){
  const id = (item?.id ?? "").trim();
  const v  = (item?.version ?? "").trim();
  return `${id}|${v}`;
}

function hashFor(item){
  // Keep it readable: #CUSA12345-01.00
  const id = (item?.id ?? "").trim();
  const v  = (item?.version ?? "").trim();
  // encode just in case, but keep dash separator
  return `#${encodeURIComponent(id)}-${encodeURIComponent(v)}`;
}

function parseHash(){
  // Expected: #ID-VERSION
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return null;

  // split on last '-' in case ID contains dashes (unlikely but safe)
  const idx = h.lastIndexOf("-");
  if (idx <= 0 || idx >= h.length - 1) return null;

  const id = decodeURIComponent(h.slice(0, idx)).trim();
  const v  = decodeURIComponent(h.slice(idx + 1)).trim();
  if (!id || !v) return null;

  return `${id}|${v}`;
}

function cardHtml(item, idx){
  const id = item.id ?? "";
  const version = item.version ?? "";
  const title = item.title ?? "";
  const total = Number(item.cheatsTotal ?? 0);
  const f = item.formats ?? {};

  return `
    <article class="card" data-idx="${idx}">
      <div class="top">
        <div>
          <div class="id">
            <span>${safeHtml(id)}</span>
            <span class="tag">v${safeHtml(version)}</span>
            <span class="tag">${total} cheats</span>
          </div>
          <div class="name">${safeHtml(title)}</div>
        </div>

        <div class="badges">
          ${badgeHtml("json", f.json)}
          ${badgeHtml("shn",  f.shn)}
          ${badgeHtml("mc4",  f.mc4)}
        </div>
      </div>
    </article>
  `;
}

function render(items){
  elGrid.innerHTML = items.map((x) => cardHtml(x, all.indexOf(x))).join("");
  elCount.textContent = String(items.length);
  elTotal.textContent = String(all.length);
  elEmpty.style.display = items.length ? "none" : "block";
}

function applyFilter(){
  const q = norm(elQ.value);

  if (!q){
    render(all);
    return;
  }

  const filtered = all.filter(x => {
    const id = x.idLower ? norm(x.idLower) : norm(x.id);
    const title = x.titleLower ? norm(x.titleLower) : norm(x.title);
    return id.includes(q) || title.includes(q);
  });

  render(filtered);
}

/* ---------- Modal ---------- */

function renderModalLists(filterText){
  if (!current){
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

  const filtered = formats.map(f => ({
    ...f,
    cheats: q ? f.cheats.filter(c => norm(c).includes(q)) : f.cheats
  }));

  const totalMatches = filtered.reduce((sum, f) => sum + f.cheats.length, 0);
  if (q && totalMatches === 0){
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

  const sectionHtml = (label, items) => {
    const count = items.length;
    const title = `${label.toUpperCase()} cheats`;
    if (!count){
      return `
        <div class="section">
          <div class="section__head">
            <div class="section__title">${safeHtml(title)}</div>
            <div class="section__count">0</div>
          </div>
          <div class="section__body">
            <div class="muted-note">No cheats listed for this format.</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section__head">
          <div class="section__title">${safeHtml(title)}</div>
          <div class="section__count">${count}</div>
        </div>
        <div class="section__body">
          <ol class="cheats">
            ${items.map(x => `<li>${safeHtml(x)}</li>`).join("")}
          </ol>
        </div>
      </div>
    `;
  };

  elMLists.innerHTML = filtered.map(f => sectionHtml(f.key, f.cheats)).join("");
}

function openModal(item, { setHash = true } = {}){
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

  const f = item.formats ?? {};
  elMBadges.innerHTML = `
    ${badgeHtml("json", f.json)}
    ${badgeHtml("shn",  f.shn)}
    ${badgeHtml("mc4",  f.mc4)}
  `;

  elMQ.value = "";
  renderModalLists("");

  elModal.classList.add("is-open");
  elModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  if (setHash){
    const h = hashFor(item);
    if (location.hash !== h) history.pushState(null, "", h);
  }

  setTimeout(() => elMQ.focus(), 0);
}

function closeModal({ clearHash = true } = {}){
  elModal.classList.remove("is-open");
  elModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  current = null;

  if (clearHash && location.hash){
    history.pushState(null, "", location.pathname + location.search);
  }
}

function openFromHash(){
  const key = parseHash();
  if (!key) return false;

  const item = byKey.get(key);
  if (!item) return false;

  // open without pushing hash again
  openModal(item, { setHash: false });
  return true;
}

/* ---------- Boot ---------- */

async function boot(){
  try{
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    all = Array.isArray(data) ? data : (Array.isArray(data?.entries) ? data.entries : []);

    all.sort((a,b) => {
      const t = (a.titleLower ?? a.title ?? "").localeCompare((b.titleLower ?? b.title ?? ""), "en", { sensitivity:"base" });
      if (t) return t;
      const i = (a.id ?? "").localeCompare((b.id ?? ""), "en", { sensitivity:"base" });
      if (i) return i;
      return (a.version ?? "").localeCompare((b.version ?? ""), "en", { sensitivity:"base" });
    });

    // Build map for deep links
    byKey = new Map();
    for (const item of all) byKey.set(makeKey(item), item);

    render(all);

    // If page opened with hash, open that game
    openFromHash();
  }catch(err){
    elGrid.innerHTML = `
      <div class="empty">
        <b>Failed to load data.</b><br/>
        Make sure <span class="kbd">${safeHtml(DATA_URL)}</span> is in the same folder as index.html.<br/><br/>
        Error: <span class="kbd">${safeHtml(String(err))}</span>
      </div>
    `;
  }
}

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

  if (!key){
    // hash cleared -> close if open
    if (elModal.classList.contains("is-open")) closeModal({ clearHash: false });
    return;
  }

  const item = byKey.get(key);
  if (item){
    // open if not already that item
    const curKey = current ? makeKey(current) : "";
    if (!elModal.classList.contains("is-open") || curKey !== key){
      openModal(item, { setHash: false });
    }
  }
});

boot();
