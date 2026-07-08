const tbody = document.querySelector("#coinsTable tbody");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");

let allCoins = [];
let timerId = null;
let isLoading = false;

function formatMoney(n) {
  return `$${Number(n ?? 0).toLocaleString()}`;
}

function renderRows(coins) {
  tbody.innerHTML = "";

  if (!coins.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">No matching coins</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const coin of coins) {
    const tr = document.createElement("tr");
    const pct = coin.price_change_percentage_24h ?? 0;

    tr.innerHTML = `
      <td>${coin.name}</td>
      <td>${coin.symbol.toUpperCase()}</td>
      <td>${formatMoney(coin.current_price)}</td>
      <td class="${pct >= 0 ? "pos" : "neg"}">${pct.toFixed(2)}%</td>
      <td>${formatMoney(coin.market_cap)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function applyFilter() {
  const q = document.getElementById("searchInput")?.value?.trim().toLowerCase() || "";
  if (!q) return renderRows(allCoins);

  const filtered = allCoins.filter(
    c =>
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
  );
  renderRows(filtered);
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
    applyFilter();
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

function ensureSearchUI() {
  const controls = document.querySelector(".controls");
  if (!controls) return;

  if (!document.getElementById("searchInput")) {
    const input = document.createElement("input");
    input.id = "searchInput";
    input.type = "text";
    input.placeholder = "Search coin or symbol (e.g. btc, ethereum)";
    input.style.padding = "10px 12px";
    input.style.borderRadius = "10px";
    input.style.border = "1px solid #263056";
    input.style.background = "#0b1020";
    input.style.color = "#e8ecf7";
    input.style.minWidth = "260px";
    input.addEventListener("input", applyFilter);
    controls.appendChild(input);
  }
}

refreshBtn.addEventListener("click", fetchCoins);
ensureSearchUI();
fetchCoins();
startAutoRefresh();
