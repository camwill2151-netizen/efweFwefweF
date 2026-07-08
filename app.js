const tbody = document.querySelector("#coinsTable tbody");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");
const subtitleEl = document.querySelector(".subtitle");

let allCoins = [];
let timerId = null;
let isLoading = false;
let sortKey = "market_cap";
let sortDir = "desc";

function formatMoney(n) {
  return `$${Number(n ?? 0).toLocaleString()}`;
}

function signalForCoin(coin) {
  const pct = Number(coin.price_change_percentage_24h ?? 0);
  if (pct <= -3) return "BUY";
  if (pct >= 5) return "SELL";
  return "HOLD";
}

function signalClass(signal) {
  if (signal === "BUY") return "sig-buy";
  if (signal === "SELL") return "sig-sell";
  return "sig-hold";
}

function compare(a, b, key, dir) {
  const av = Number(a?.[key] ?? 0);
  const bv = Number(b?.[key] ?? 0);
  return dir === "asc" ? av - bv : bv - av;
}

function getFilteredCoins() {
  const q = document.getElementById("searchInput")?.value?.trim().toLowerCase() || "";
  let list = [...allCoins];

  if (q) {
    list = list.filter(
      c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => compare(a, b, sortKey, sortDir));
  return list;
}

function renderTopMover(coins) {
  if (!subtitleEl) return;
  if (!coins.length) {
    subtitleEl.textContent = "Simple live market view";
    return;
  }
  const top = [...coins].sort(
    (a, b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999)
  )[0];
  const pct = Number(top.price_change_percentage_24h ?? 0).toFixed(2);
  subtitleEl.textContent = `Top mover: ${top.name} (${top.symbol.toUpperCase()}) ${pct}%`;
}

function renderRows(coins) {
  tbody.innerHTML = "";

  if (!coins.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">No matching coins</td>`;
    tbody.appendChild(tr);
    renderTopMover([]);
    return;
  }

  for (const coin of coins) {
    const tr = document.createElement("tr");
    const pct = Number(coin.price_change_percentage_24h ?? 0);
    const signal = signalForCoin(coin);

    tr.innerHTML = `
      <td>${coin.name}</td>
      <td>${coin.symbol.toUpperCase()}</td>
      <td>${formatMoney(coin.current_price)}</td>
      <td class="${pct >= 0 ? "pos" : "neg"}">${pct.toFixed(2)}%</td>
      <td>${formatMoney(coin.market_cap)}</td>
      <td><span class="signal ${signalClass(signal)}">${signal}</span></td>
    `;
    tbody.appendChild(tr);
  }

  renderTopMover(coins);
}

function applyFilterAndSort() {
  renderRows(getFilteredCoins());
}

async function fetchCoins() {
  if (isLoading) return;
  isLoading = true;
  statusEl.textContent = "Loading...";
  refreshBtn.disabled = true;

  try {
    const url =
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allCoins = await res.json();
    applyFilterAndSort();
    statusEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Failed to load market data";
  } finally {
    refreshBtn.disabled = false;
    isLoading = false;
  }
}

function startAutoRefresh() {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(fetchCoins, 30000);
}

function ensureControlsUI() {
  const controls = document.querySelector(".controls");
  if (!controls) return;

  if (!document.getElementById("searchInput")) {
    const input = document.createElement("input");
    input.id = "searchInput";
    input.type = "text";
    input.placeholder = "Search coin or symbol";
    input.style.padding = "10px 12px";
    input.style.borderRadius = "10px";
    input.style.border = "1px solid #263056";
    input.style.background = "#0b1020";
    input.style.color = "#e8ecf7";
    input.style.minWidth = "220px";
    input.addEventListener("input", applyFilterAndSort);
    controls.appendChild(input);
  }

  if (!document.getElementById("sortSelect")) {
    const select = document.createElement("select");
    select.id = "sortSelect";
    select.style.padding = "10px 12px";
    select.style.borderRadius = "10px";
    select.style.border = "1px solid #263056";
    select.style.background = "#0b1020";
    select.style.color = "#e8ecf7";

    select.innerHTML = `
      <option value="market_cap:desc">Sort: Market Cap ↓</option>
      <option value="market_cap:asc">Sort: Market Cap ↑</option>
      <option value="current_price:desc">Sort: Price ↓</option>
      <option value="current_price:asc">Sort: Price ↑</option>
      <option value="price_change_percentage_24h:desc">Sort: 24h % ↓</option>
      <option value="price_change_percentage_24h:asc">Sort: 24h % ↑</option>
    `;

    select.addEventListener("change", (e) => {
      const [k, d] = e.target.value.split(":");
      sortKey = k;
      sortDir = d;
      applyFilterAndSort();
    });

    controls.appendChild(select);
  }
}

function ensureSignalHeader() {
  const headRow = document.querySelector("#coinsTable thead tr");
  if (!headRow) return;
  const hasSignal = [...headRow.children].some(th => th.textContent.trim().toLowerCase() === "signal");
  if (!hasSignal) {
    const th = document.createElement("th");
    th.textContent = "Signal";
    headRow.appendChild(th);
  }
}

refreshBtn.addEventListener("click", fetchCoins);
ensureControlsUI();
ensureSignalHeader();
fetchCoins();
startAutoRefresh();
