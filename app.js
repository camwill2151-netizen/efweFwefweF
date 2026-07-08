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
function isStablecoin(c){ return STABLE_SYMBOLS.has(String(c.symbol||"").toLowerCase()); }
function signalForPct(pct){ if (pct <= -3) return "BUY"; if (pct >= 5) return "SELL"; return "HOLD"; }
function signalClass(s){ return s==="BUY" ? "sig-buy" : s==="SELL" ? "sig-sell" : "sig-hold"; }
function compare(a,b,key,dir){ const av=Number(a?.[key]??0), bv=Number(b?.[key]??0); return dir==="asc" ? av-bv : bv-av; }

function timeframePct(coin, tf){
  const p1h = Number(coin.price_change_percentage_1h_in_currency ?? 0);
  const p24h = Number(coin.price_change_percentage_24h ?? 0);
  const p7d = Number(coin.price_change_percentage_7d_in_currency ?? 0);

  if (tf === "1h") return p1h;
  if (tf === "4h") return p1h * 4; // approximation fallback
  if (tf === "7d") return p7d;
  return p24h; // 24h
}

function getFilteredCoins(){
  const q = (searchInput?.value || "").trim().toLowerCase();
  const hide = hideStable?.checked ?? false;
  let list = [...allCoins];

  if (hide) list = list.filter(c => !isStablecoin(c));
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));

  list.sort((a,b)=>compare(a,b,sortKey,sortDir));
  return list;
}

function renderRows(coins){
  tbody.innerHTML = "";
  if (!coins.length){ tbody.innerHTML = `<tr><td colspan="7">No matching coins</td></tr>`; return; }

  for (const c of coins){
    const pct = Number(c.tf_change_pct ?? 0);
    const sig = signalForPct(pct);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.symbol.toUpperCase()}</td>
      <td>${formatMoney(c.current_price)}</td>
      <td class="${pct>=0?"pos":"neg"}">${pct.toFixed(2)}%</td>
      <td>${selectedTf}</td>
      <td>${formatMoney(c.market_cap)}</td>
      <td><span class="signal ${signalClass(sig)}">${sig}</span></td>
    `;
    tbody.appendChild(tr);
  }

  const top = [...coins].sort((a,b)=>(b.tf_change_pct??-999)-(a.tf_change_pct??-999))[0];
  if (subtitleEl && top) subtitleEl.textContent = `Top mover (${selectedTf}): ${top.name} ${Number(top.tf_change_pct??0).toFixed(2)}%`;
}

function applyFilterAndSort(){ renderRows(getFilteredCoins()); }

async function fetchCoins(){
  if (isLoading) return;
  isLoading = true;
  selectedTf = tfSelect?.value || "24h";
  statusEl.textContent = `Loading ${selectedTf} scanner...`;
  refreshBtn.disabled = true;

  try{
    const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const base = await res.json();

    allCoins = base.slice(0, 50).map(c => ({ ...c, tf_change_pct: timeframePct(c, selectedTf) }));
    applyFilterAndSort();
    statusEl.textContent = `Updated (${selectedTf}): ${new Date().toLocaleTimeString()}`;
  }catch(err){
    console.error(err);
    statusEl.textContent = "Failed to load scanner data";
  }finally{
    refreshBtn.disabled = false;
    isLoading = false;
  }
}

function startAutoRefresh(){ if (timerId) clearInterval(timerId); timerId = setInterval(fetchCoins, 60000); }

refreshBtn.addEventListener("click", fetchCoins);
tfSelect.addEventListener("change", fetchCoins);
searchInput.addEventListener("input", applyFilterAndSort);
sortSelect.addEventListener("change", (e)=>{ [sortKey, sortDir] = e.target.value.split(":"); applyFilterAndSort(); });
hideStable.addEventListener("change", applyFilterAndSort);

fetchCoins();
startAutoRefresh();
