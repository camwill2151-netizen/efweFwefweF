const tbody = document.querySelector("#coinsTable tbody");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");
const subtitleEl = document.querySelector(".subtitle");

const tfSelect = document.getElementById("tfSelect");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const hideStable = document.getElementById("hideStable");

let allCoins = [];
let timerId = null;
let isLoading = false;
let selectedTf = tfSelect?.value || "24h";
let sortKey = "market_cap";
let sortDir = "desc";

const STABLE_SYMBOLS = new Set(["usdt","usdc","dai","busd","tusd","usdp","fdusd","gusd","lusd","frax","pyusd","usdd"]);

function formatMoney(n){ return `$${Number(n ?? 0).toLocaleString()}`; }
function isStablecoin(c){ return STABLE_SYMBOLS.has(String(c.symbol || "").toLowerCase()); }
function signalForPct(pct){ if (pct <= -2) return "BUY"; if (pct >= 2.5) return "SELL"; return "HOLD"; }
function signalClass(s){ return s==="BUY" ? "sig-buy" : s==="SELL" ? "sig-sell" : "sig-hold"; }
function compare(a,b,key,dir){ const av=Number(a?.[key] ?? 0), bv=Number(b?.[key] ?? 0); return dir==="asc" ? av-bv : bv-av; }

function tfFrom24h(p24h, tf){
  const v = Number(p24h ?? 0);
  if (tf === "1h") return v / 24;
  if (tf === "4h") return v / 6;
  if (tf === "7d") return v * 7;
  return v; // 24h
}

function getFilteredCoins(){
  const q = (searchInput?.value || "").trim().toLowerCase();
  const hide = hideStable?.checked ?? false;

  let list = [...allCoins];

  if (hide) list = list.filter(c => !isStablecoin(c));

  if (q) {
    list = list.filter(c => {
      const name = String(c.name || "").toLowerCase();
      const sym = String(c.symbol || "").toLowerCase();
      return name.includes(q) || sym.includes(q);
    });
  }

  list.sort((a,b)=>compare(a,b,sortKey,sortDir));
  return list;
}

function renderRows(coins){
  tbody.innerHTML = "";
  if (!coins.length){
    tbody.innerHTML = `<tr><td colspan="7">No matching coins</td></tr>`;
    if (subtitleEl) subtitleEl.textContent = "No matches for current filters";
    return;
  }

  for (const c of coins){
    const pct = Number(c.tf_change_pct ?? 0);
    const sig = signalForPct(pct);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${String(c.symbol || "").toUpperCase()}</td>
      <td>${formatMoney(c.current_price)}</td>
      <td class="${pct >= 0 ? "pos" : "neg"}">${pct.toFixed(2)}%</td>
      <td>${selectedTf}</td>
      <td>${formatMoney(c.market_cap)}</td>
      <td><span class="signal ${signalClass(sig)}">${sig}</span></td>
    `;
    tbody.appendChild(tr);
  }

  const top = [...coins].sort((a,b)=>(b.tf_change_pct??-999)-(a.tf_change_pct??-999))[0];
  if (subtitleEl && top) subtitleEl.textContent = `Top mover (${selectedTf}): ${top.name} ${Number(top.tf_change_pct ?? 0).toFixed(2)}%`;
}

function applyFilterAndSort(){
  const visible = getFilteredCoins();
  renderRows(visible);
}

async function fetchCoins(){
  if (isLoading) return;
  isLoading = true;
  selectedTf = tfSelect?.value || "24h";
  statusEl.textContent = `Loading ${selectedTf} scanner...`;
  refreshBtn.disabled = true;

  try{
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const base = await res.json();

    allCoins = base.slice(0, 100).map(c => ({
      ...c,
      tf_change_pct: tfFrom24h(c.price_change_percentage_24h, selectedTf)
    }));

    applyFilterAndSort();

    const counts = allCoins.reduce((a,c)=>{ const s=signalForPct(c.tf_change_pct); a[s]=(a[s]||0)+1; return a; }, {});
    statusEl.textContent = `Updated (${selectedTf}): ${new Date().toLocaleTimeString()} | BUY:${counts.BUY||0} HOLD:${counts.HOLD||0} SELL:${counts.SELL||0}`;
  } catch(err){
    console.error(err);
    statusEl.textContent = "Failed to load scanner data";
  } finally {
    refreshBtn.disabled = false;
    isLoading = false;
  }
}

function startAutoRefresh(){
  if (timerId) clearInterval(timerId);
  timerId = setInterval(fetchCoins, 60000);
}

refreshBtn?.addEventListener("click", fetchCoins);
tfSelect?.addEventListener("change", fetchCoins);
searchInput?.addEventListener("input", applyFilterAndSort);
sortSelect?.addEventListener("change", (e)=>{ [sortKey, sortDir] = e.target.value.split(":"); applyFilterAndSort(); });
hideStable?.addEventListener("change", applyFilterAndSort);

fetchCoins();
startAutoRefresh();
