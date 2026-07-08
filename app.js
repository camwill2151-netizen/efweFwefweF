const tbody = document.querySelector("#coinsTable tbody");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");
const subtitleEl = document.querySelector(".subtitle");

let allCoins = [];
let timerId = null;
let isLoading = false;
let sortKey = "market_cap";
let sortDir = "desc";
let selectedTf = "24h";

const STABLE_SYMBOLS = new Set(["usdt","usdc","dai","busd","tusd","usdp","fdusd","gusd","lusd","frax","pyusd","usdd"]);
const TF_TO_HOURS = { "1h": 1, "4h": 4, "24h": 24, "7d": 168 };

function formatMoney(n){ return `$${Number(n ?? 0).toLocaleString()}`; }
function isStablecoin(c){ return STABLE_SYMBOLS.has(String(c.symbol||"").toLowerCase()); }
function signalForPct(pct){ if (pct <= -3) return "BUY"; if (pct >= 5) return "SELL"; return "HOLD"; }
function signalClass(s){ return s==="BUY" ? "sig-buy" : s==="SELL" ? "sig-sell" : "sig-hold"; }
function compare(a,b,key,dir){ const av=Number(a?.[key]??0), bv=Number(b?.[key]??0); return dir==="asc" ? av-bv : bv-av; }

function getFilteredCoins(){
  const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  const hideStable = document.getElementById("hideStable")?.checked ?? false;
  let list = [...allCoins];
  if (hideStable) list = list.filter(c => !isStablecoin(c));
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
  list.sort((a,b)=>compare(a,b,sortKey,sortDir));
  return list;
}

function renderTopMover(coins){
  if (!subtitleEl) return;
  if (!coins.length) { subtitleEl.textContent = "Scanner ready"; return; }
  const top = [...coins].sort((a,b)=>(b.tf_change_pct??-999)-(a.tf_change_pct??-999))[0];
  subtitleEl.textContent = `Top mover (${selectedTf}): ${top.name} (${top.symbol.toUpperCase()}) ${Number(top.tf_change_pct??0).toFixed(2)}%`;
}

function renderRows(coins){
  tbody.innerHTML = "";
  if (!coins.length){ tbody.innerHTML = `<tr><td colspan="7">No matching coins</td></tr>`; renderTopMover([]); return; }
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
  renderTopMover(coins);
}

function applyFilterAndSort(){ renderRows(getFilteredCoins()); }

async function getTfChangePct(coinId, currentPrice, hours){
  const days = hours <= 24 ? 1 : 7;
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=hourly`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`chart ${coinId} HTTP ${res.status}`);
  const data = await res.json();
  const prices = data?.prices || [];
  if (!prices.length) return 0;

  const targetTs = Date.now() - hours * 60 * 60 * 1000;
  let closest = prices[0], minDelta = Math.abs(prices[0][0]-targetTs);
  for (const p of prices){ const d=Math.abs(p[0]-targetTs); if (d<minDelta){ minDelta=d; closest=p; } }

  const past = Number(closest[1] ?? 0);
  if (!past) return 0;
  return ((Number(currentPrice)-past)/past)*100;
}

async function enrichTimeframeChanges(baseCoins){
  const hours = TF_TO_HOURS[selectedTf] || 24;
  const top = baseCoins.slice(0, 20);
  const out = [];
  for (const c of top){
    try { out.push({ ...c, tf_change_pct: await getTfChangePct(c.id, c.current_price, hours) }); }
    catch { out.push({ ...c, tf_change_pct: 0 }); }
  }
  return out;
}

async function fetchCoins(){
  if (isLoading) return;
  isLoading = true;
  statusEl.textContent = `Loading ${selectedTf} scanner...`;
  refreshBtn.disabled = true;
  try{
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const base = await res.json();
    allCoins = await enrichTimeframeChanges(base);
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

function ensureControlsUI(){
  const controls = document.querySelector(".controls");
  if (!controls) return;

  if (!document.getElementById("searchInput")){
    const i = document.createElement("input");
    i.id="searchInput"; i.type="text"; i.placeholder="Search coin or symbol";
    i.style.padding="10px 12px"; i.style.borderRadius="10px"; i.style.border="1px solid #263056";
    i.style.background="#0b1020"; i.style.color="#e8ecf7"; i.style.minWidth="180px";
    i.addEventListener("input", applyFilterAndSort);
    controls.appendChild(i);
  }

  if (!document.getElementById("tfSelect")){
    const tf = document.createElement("select");
    tf.id="tfSelect";
    tf.style.padding="10px 12px"; tf.style.borderRadius="10px"; tf.style.border="1px solid #263056";
    tf.style.background="#0b1020"; tf.style.color="#e8ecf7";
    tf.innerHTML = `
      <option value="1h">Timeframe: 1 Hour</option>
      <option value="4h">Timeframe: 4 Hours</option>
      <option value="24h" selected>Timeframe: 1 Day</option>
      <option value="7d">Timeframe: 1 Week</option>
    `;
    tf.addEventListener("change", async (e)=>{ selectedTf=e.target.value; await fetchCoins(); });
    controls.appendChild(tf);
  }

  if (!document.getElementById("sortSelect")){
    const s = document.createElement("select");
    s.id="sortSelect";
    s.style.padding="10px 12px"; s.style.borderRadius="10px"; s.style.border="1px solid #263056";
    s.style.background="#0b1020"; s.style.color="#e8ecf7";
    s.innerHTML = `
      <option value="market_cap:desc">Sort: Market Cap ↓</option>
      <option value="market_cap:asc">Sort: Market Cap ↑</option>
      <option value="current_price:desc">Sort: Price ↓</option>
      <option value="current_price:asc">Sort: Price ↑</option>
      <option value="tf_change_pct:desc">Sort: Change ↓</option>
      <option value="tf_change_pct:asc">Sort: Change ↑</option>
    `;
    s.addEventListener("change",(e)=>{ const [k,d]=e.target.value.split(":"); sortKey=k; sortDir=d; applyFilterAndSort(); });
    controls.appendChild(s);
  }

  if (!document.getElementById("hideStable")){
    const wrap = document.createElement("label");
    wrap.style.display="inline-flex"; wrap.style.alignItems="center"; wrap.style.gap="8px";
    wrap.style.fontSize="14px"; wrap.style.color="#9aa4c7";
    const cb = document.createElement("input");
    cb.type="checkbox"; cb.id="hideStable"; cb.addEventListener("change", applyFilterAndSort);
    wrap.appendChild(cb); wrap.appendChild(document.createTextNode("Hide stablecoins"));
    controls.appendChild(wrap);
  }
}

function ensureHeaders(){
  const headRow = document.querySelector("#coinsTable thead tr");
  if (!headRow) return;
  headRow.innerHTML = `
    <th>Coin</th><th>Symbol</th><th>Price (USD)</th><th>Change %</th><th>Timeframe</th><th>Market Cap</th><th>Signal</th>
  `;
}

refreshBtn.addEventListener("click", fetchCoins);
ensureControlsUI();
ensureHeaders();
fetchCoins();
startAutoRefresh();
