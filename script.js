
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjkyMzBkNGU3LWUyNjEtNGNiYi1hYzgzLTY4MDZmNDg5YzRhOSIsIm9yZ0lkIjoiNDUzNzM2IiwidXNlcklkIjoiNDY2ODMzIiwidHlwZUlkIjoiODVkOTcxZDMtODgzOS00NmYxLWJiMGEtM2IyY2Y5ZmE4NTU2IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDk4MDU3MTcsImV4cCI6NDkwNTU2NTcxN30.nbLVfn0ocROspwVeWXIOtw-d6Gm42Bnshujhlp3JrMI';
const SOLSCAN_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDk4NjAwMjIwMDUsImVtYWlsIjoid2F4amluaG8wMkBnbWFpbC5jb20iLCJhY3Rpb24iOiJ0b2tlbi1hcGkiLCJhcGlWZXJzaW9uIjoidjIiLCJpYXQiOjE3NDk4NjAwMjJ9.I1laMt2a0wIiMeQ0JFEDDWWqvwLQvnSjcS0mdvy-vM0';

const HOLDER_TIMES = ['5m', '1h', '6h', '24h', '3d', '7d', '30d'];
const RATIO_TIMES = ['5m', '1h', '6h', '24h'];

async function showResults(fromFloating) {
  const ca = fromFloating
    ? document.getElementById("floatingInput")?.value || document.getElementById("mobileInput")?.value
    : document.getElementById("tokenInput").value;

  if (!ca || ca.length < 6) {
    showError();
    return;
  }

  // Validate contract address via Solscan
  let valid = false;
  try {
    const res = await fetch(`https://pro-api.solscan.io/v2.0/token/meta?Address=${ca}`,
      { headers: { Authorization: SOLSCAN_API_KEY } });
    valid = res.ok;
  } catch (e) {}

  if (!valid) {
    showError();
    return;
  }

  // store recent searches
  let recents = JSON.parse(localStorage.getItem("recents") || "[]");
  recents = [ca, ...recents.filter((x) => x !== ca)].slice(0, 5);
  localStorage.setItem("recents", JSON.stringify(recents));
  const ul = document.getElementById("recent-list");
  if (ul) ul.innerHTML = recents.map((x) => `<li onclick="loadRecent('${x}')">${x}</li>`).join("");

  document.getElementById("intro").style.display = "none";
  document.getElementById("results").classList.remove("hidden");
  document.getElementById("error-message").classList.add("hidden");
  document.getElementById("floating-search")?.classList.remove("hidden");
  document.getElementById("floating-button")?.classList.remove("hidden");
  document.getElementById("recent-searches")?.classList.remove("hidden");
  document.getElementById("project-info")?.style.setProperty("display", "none");

  window.scrollTo({ top: 0, behavior: "smooth" });

  loadTokenData(ca);
}

function loadRecent(ca) {
  document.getElementById("floatingInput").value = ca;
  showResults(true);
}

function showError() {
  document.getElementById("results").classList.add("hidden");
  document.getElementById("error-message").classList.remove("hidden");
}
function toggleMobileSearch() {
  const el = document.getElementById("mobile-search");
  el.classList.toggle("hidden");
}

async function loadTokenData(address) {
  const header = document.querySelector('.token-header h2');
  if (header) header.textContent = 'Loading...';
  const [meta, price, analytics, holders, holderChange, swaps, solMeta] = await Promise.all([
    fetch(`https://solana-gateway.moralis.io/token/mainnet/${address}/metadata`, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
    fetch(`https://solana-gateway.moralis.io/token/mainnet/${address}/price`, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
    fetch(`https://deep-index.moralis.io/api/v2.2/tokens/${address}/analytics`, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
    fetch(`https://solana-gateway.moralis.io/token/mainnet/${address}/top-holders`, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
    fetch(`https://pro-api.solscan.io/v2.0/token/holders?Address=${address}`, {
      headers: { Authorization: SOLSCAN_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
    fetch(`https://solana-gateway.moralis.io/token/mainnet/${address}/swaps`, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
    fetch(`https://pro-api.solscan.io/v2.0/token/meta?Address=${address}`, {
      headers: { Authorization: SOLSCAN_API_KEY }
    }).then(r => r.json()).catch(() => ({})),
  ]);

  updateHeader(meta, price, analytics, solMeta);
  updateChart(address);
  updateTopHolders(holders);
  initHolderChange(address, holderChange);
  updateRecentSwaps(swaps);
  initBuySellRatio(address, analytics);
}

function updateHeader(meta, price, analytics, solMeta) {
  const header = document.querySelector('.token-header');
  const img = header.querySelector('img');
  if (meta.logo) img.src = meta.logo;

  const h2 = header.querySelector('h2');
  const change = price.usdPrice_24hr_percent_change ?? price.usdPrice_24h_percent_change ?? price.priceChange24h ?? 0;
  const changeClass = change >= 0 ? 'positive' : 'negative';
  h2.innerHTML = `${meta.symbol || ''} <span class="price">${price.usdPrice ? '$' + Number(price.usdPrice).toFixed(3) : ''}</span>` +
    `<span class="price-change ${changeClass}">${change ? (change > 0 ? '+' : '') + Number(change).toFixed(2) + '%' : ''}</span>`;

  const metas = header.querySelectorAll('.meta');
  const mc = analytics.totalFullyDilutedValuation ?? solMeta.fullyDilutedValue;
  if (metas[0]) metas[0].textContent = `Market Cap: ${formatCurrency(mc)} · Liquidity: ${formatCurrency(analytics.totalLiquidityUsd)}`;
  if (metas[1]) metas[1].textContent = `Supply: ${formatNumber(meta.totalSupply || meta.supply)}`;
  if (metas[2]) {
    const created = solMeta.firstBlockTime ? new Date(solMeta.firstBlockTime * 1000).toLocaleDateString() : '';
    const volume = solMeta.volume24h ? formatCurrency(solMeta.volume24h) : '';
    const holders = solMeta.holder ?? solMeta.holdersCount ?? '';
    metas[2].textContent = `Volume24h: ${volume} · Holders: ${holders} · Created: ${created}`;
  }
}

function updateChart(address) {
  const container = document.querySelector('.chart');
  if (!container) return;
  container.innerHTML = '';
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@moralisweb3/charts/dist/widget.js';
  script.onload = () => {
    // eslint-disable-next-line no-undef
    new MoralisCharts.TokenPriceChart({ container, tokenAddress: address });
  };
  document.body.appendChild(script);
}

function updateTopHolders(data) {
  const div = document.querySelectorAll('.section-grid')[0].children[0];
  if (!div) return;
  const holders = (data.result || []).slice(0, 10);
  div.innerHTML = '<h4>Top Holders</h4><ul>' +
    holders.map(h => `<li><a href="https://solscan.io/account/${h.address}" target="_blank">${shorten(h.address)}</a> - ${Number(h.share).toFixed(2)}%</li>`).join('') +
    '</ul>';
}

function initHolderChange(address, data) {
  const div = document.querySelectorAll('.section-grid')[0].children[1];
  if (!div) return;
  div.innerHTML = '<h4>Holder Change</h4><select id="holder-time"></select><p id="holder-value">Loading...</p>';
  const sel = div.querySelector('#holder-time');
  sel.innerHTML = HOLDER_TIMES.map(t => `<option value="${t}">${t}</option>`).join('');
  sel.addEventListener('change', () => loadHolderChange(address, sel.value));
  updateHolderChange(data);
}

async function loadHolderChange(address, time) {
  const p = document.getElementById('holder-value');
  if (p) p.textContent = 'Loading...';
  const res = await fetch(`https://pro-api.solscan.io/v2.0/token/holders?Address=${address}&time=${time}`, {
    headers: { Authorization: SOLSCAN_API_KEY }
  }).then(r => r.json()).catch(() => ({}));
  updateHolderChange(res);
}

function updateHolderChange(data) {
  const p = document.getElementById('holder-value');
  if (!p) return;
  const change = data.change || 0;
  const pct = data.changePercent ? ` (${Number(data.changePercent).toFixed(2)}%)` : '';
  p.textContent = `${change >= 0 ? '+' : ''}${change}${pct}`;
}

function updateRecentSwaps(data) {
  const list = document.querySelectorAll('.section-grid')[1].children[0].querySelector('ul');
  if (!list) return;
  const swaps = (data.result || []).slice(0, 10);
  list.innerHTML = swaps.map(s => {
    const side = s.side?.toLowerCase() === 'buy' ? 'buy' : 'sell';
    const addr = shorten(s.walletAddress);
    const amt = formatCurrency(s.quoteTokenPriceUsd);
    const time = relativeTime(s.blockTimestamp);
    const tx = s.transactionSignature || s.txHash || s.transactionHash;
    return `<li class="${side}"><a href="https://solscan.io/tx/${tx}" target="_blank">${side === 'buy' ? 'Buy' : 'Sell'} - ${amt}</a> - ${addr} - ${time}</li>`;
  }).join('');
}

function initBuySellRatio(address, data) {
  const div = document.querySelectorAll('.section-grid')[1].children[1];
  if (!div) return;
  div.innerHTML = '<h4>Buy/Sell Ratio</h4><select id="ratio-time"></select><p id="ratio-value">Loading...</p>';
  const sel = div.querySelector('#ratio-time');
  sel.innerHTML = RATIO_TIMES.map(t => `<option value="${t}">${t}</option>`).join('');
  sel.addEventListener('change', () => loadBuySellRatio(address, sel.value));
  updateBuySellRatio(data);
}

async function loadBuySellRatio(address, time) {
  const p = document.getElementById('ratio-value');
  if (p) p.textContent = 'Loading...';
  const res = await fetch(`https://deep-index.moralis.io/api/v2.2/tokens/${address}/analytics?timeFrame=${time}`, {
    headers: { 'X-API-Key': MORALIS_API_KEY }
  }).then(r => r.json()).catch(() => ({}));
  updateBuySellRatio(res);
}

function updateBuySellRatio(data) {
  const p = document.getElementById('ratio-value');
  if (!p) return;
  const buyVol = Number(data.totalBuyVolume || 0);
  const sellVol = Number(data.totalSellVolume || 0);
  const total = buyVol + sellVol || 1;
  const buyPct = (buyVol / total) * 100;
  const sellPct = 100 - buyPct;
  p.innerHTML = `<span class="buy">Buy ${buyPct.toFixed(0)}%</span> / <span class="sell">Sell ${sellPct.toFixed(0)}%</span>`;
}

function formatCurrency(num) {
  num = Number(num || 0);
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'k';
  return '$' + num.toFixed(2);
}

function formatNumber(num) {
  num = Number(num || 0);
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return String(num);
}

function shorten(addr) {
  return addr ? addr.slice(0, 4) + '...' + addr.slice(-4) : '';
}

function relativeTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Hide floating search components on non-result pages using classList
window.addEventListener('DOMContentLoaded', () => {
  const isVisible = !document.getElementById('results')?.classList.contains('hidden');
  if (!isVisible) {
    const ids = ['floating-search', 'mobile-search', 'floating-button', 'recent-searches'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
    });
    const infoBox = document.getElementById('project-info');
    if (infoBox) infoBox.style.display = 'none';
  }
});
