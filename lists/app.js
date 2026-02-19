const DATA_URL = "./cheatslist.json";

const elGrid  = document.getElementById("grid");
const elEmpty = document.getElementById("empty");
const elQ     = document.getElementById("q");
const elClear = document.getElementById("clear");
const elCount = document.getElementById("count");
const elTotal = document.getElementById("total");

let all = [];

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
      <span><strong>${label}</strong> ${cnt}</span>
    </div>
  `;
}

function cardHtml(item){
  const id = item.id ?? "";
  const version = item.version ?? "";
  const title = item.title ?? "";
  const total = Number(item.cheatsTotal ?? 0);
  const f = item.formats ?? {};

  return `
    <article class="card">
      <div class="top">
        <div class="id">
          <span>${safeHtml(id)}</span>
          <span class="tag">v${safeHtml(version)}</span>
          <span class="tag">${total} cheats</span>
        </div>

        <div class="name">${safeHtml(title)}</div>

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
  elGrid.innerHTML = items.map(cardHtml).join("");
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

  // Use precomputed lowercase fields if present (your JSON has idLower/titleLower)
  const filtered = all.filter(x => {
    const id = x.idLower ? norm(x.idLower) : norm(x.id);
    const title = x.titleLower ? norm(x.titleLower) : norm(x.title);
    return id.includes(q) || title.includes(q);
  });

  render(filtered);
}

async function boot(){
  try{
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // ✅ Your file stores list in data.entries
    all = Array.isArray(data) ? data : (Array.isArray(data?.entries) ? data.entries : []);

    // Sort nicely: title -> id -> version
    all.sort((a,b) => {
      const t = (a.titleLower ?? a.title ?? "").localeCompare((b.titleLower ?? b.title ?? ""), "en", { sensitivity:"base" });
      if (t) return t;
      const i = (a.id ?? "").localeCompare((b.id ?? ""), "en", { sensitivity:"base" });
      if (i) return i;
      return (a.version ?? "").localeCompare((b.version ?? ""), "en", { sensitivity:"base" });
    });

    render(all);
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

boot();
