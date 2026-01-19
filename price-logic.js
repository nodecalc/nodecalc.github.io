// price-logic.js — Standalone Pi Price + Real Chart + Wallet Operations Dots (Jan 2025+)
// For https://nodecalc.github.io/price.html

let TF = 'M';           // default: M for Month view
let pricePts = [];      // [{t: ms timestamp, c: price}]
let operations = [];    // filtered Pi operations from Jan 2025 onward

const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

const elUSD = document.getElementById('p_usd');
const elCHG = document.getElementById('p_chg');
const elVOL = document.getElementById('p_vol');
const elTS  = document.getElementById('p_ts');
const msg   = document.getElementById('msg');

// Resize canvas
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = 300 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', () => { resize(); draw(); });

// 1. Real current price + 24h change (CoinGecko)
async function loadPrice() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd&include_24hr_change=true');
    const j = await r.json();
    const data = j['pi-network'];
    if (data) {
      const price = data.usd;
      const change = data.usd_24h_change || 0;
      elUSD.textContent = price.toFixed(4);
      elCHG.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      elCHG.className = 'pill ' + (change >= 0 ? 'good' : 'bad');
      elVOL.textContent = '—';
      elTS.textContent = new Date().toLocaleTimeString();
    }
  } catch (e) {
    elTS.textContent = 'price feed unavailable';
  }
}

// 2. Real historical prices for chart (CoinGecko daily closes)
async function loadHistory(days = 365) {
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/pi-network/market_chart?vs_currency=usd&days=${days}&interval=daily`);
    const j = await r.json();
    if (j.prices && Array.isArray(j.prices)) {
      pricePts = j.prices.map(([t, c]) => ({ t, c })); // t=ms, c=price
      draw();
    }
  } catch (e) {
    console.warn('Chart history failed:', e);
  }
}

// 3. Fetch wallet operations with pagination — only from Jan 1, 2025 onward
async function loadWalletOperations(acct) {
  msg.textContent = 'Loading wallet operations (from Jan 2025)...';
  operations = [];

  const cutoffDate = new Date('2025-01-01T00:00:00Z').getTime(); // Jan 1, 2025 UTC

  let url = `https://api.mainnet.minepi.com/accounts/${acct}/operations?limit=200&order=desc`;
  let totalFetched = 0;
  const maxOps = 2000; // safety cap

  try {
    while (url && totalFetched < maxOps) {
      const r = await fetch(url);
      const j = await r.json();

      if (!j._embedded?.records?.length) break;

      // Filter only Pi-native relevant ops AFTER Jan 1, 2025
      const relevant = j._embedded.records.filter(op => {
        const opTime = new Date(op.created_at).getTime();
        return (
          opTime >= cutoffDate &&
          op.asset_type === 'native' &&
          (op.type === 'payment' || op.type.includes('claim') || op.type.includes('create_claimable'))
        );
      });

      operations.push(...relevant);
      totalFetched += relevant.length;

      // Next page cursor
      url = j._links.next?.href || null;
    }

    // Classify direction for dot color
    operations.forEach(op => {
      op.dir = 'self';
      if (op.from === acct && op.to !== acct) op.dir = 'out';
      if (op.to === acct && op.from !== acct) op.dir = 'in';
    });

    msg.textContent = `Loaded ${operations.length} relevant Pi operations (from Jan 2025) → dots on chart`;
    draw(); // redraw with dots

  } catch (e) {
    msg.textContent = 'Failed to load (check address or network)';
    console.error(e);
  }
}

// Helper: Get ISO week number
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Chart drawing
function computeBounds(pts) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const m = { left: 56, right: 10, top: 10, bottom: 28 };
  const xs = pts.map(p => p.t), ys = pts.map(p => p.c);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (!isFinite(ymin) || !isFinite(ymax) || xmin === xmax) {
    xmin = 0; xmax = 1; ymin = 0; ymax = 1;
  }
  const pad = (ymax - ymin) * 0.06 || 0.001;
  ymin -= pad; ymax += pad;
  const xp = t => m.left + (w - m.left - m.right) * (t - xmin) / (xmax - xmin || 1);
  const yp = v => h - m.bottom - (h - m.top - m.bottom) * (v - ymin) / (ymax - ymin || 1);
  return { w, h, m, xmin, xmax, ymin, ymax, xp, yp };
}

function drawAxes(b) {
  const { w, h, m, xmin, xmax, yp, xp, ymin, ymax } = b;
  ctx.strokeStyle = 'rgba(120,200,160,0.22)'; ctx.fillStyle = '#7fbf86'; ctx.lineWidth = 1;
  ctx.font = '11px ui-monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const v = ymin + (i * (ymax - ymin)) / yTicks;
    const y = yp(v);
    ctx.beginPath(); ctx.moveTo(m.left, y); ctx.lineTo(w - m.right, y); ctx.stroke();
    ctx.fillText('$' + v.toFixed(4), m.left - 6, y);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const xTicks = 7; // Last 7 intervals for day/week/month
  for (let i = 0; i <= xTicks; i++) {
    const t = xmin + (i * (xmax - xmin)) / xTicks;
    const x = xp(t);
    ctx.beginPath(); ctx.moveTo(x, h - m.bottom); ctx.lineTo(x, h - m.bottom + 4); ctx.stroke();

    const date = new Date(t);
    let label;
    if (TF === 'D') {
      label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // Jan 16
    } else if (TF === 'W') {
      label = 'Wk ' + getISOWeek(date); // Week 1,2,3,...,52
    } else if (TF === 'M') {
      // End of month dates
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      label = date.toLocaleString(undefined, { month: 'short' }) + ' ' + lastDay; // Jan 31
    } else if (TF === 'Y') {
      label = date.toLocaleString(undefined, { month: 'short' }); // Jan, Feb, etc.
    } else { // A (All)
      label = date.getFullYear(); // 2025, 2026, etc.
    }
    ctx.fillText(label, x, h - m.bottom + 6);
  }
}

function drawLine(pts, b) {
  ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = '#2dd4bf';
  pts.forEach((p, i) => {
    const x = b.xp(p.t), y = b.yp(p.c);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

// Plot dots for operations within chart timeframe
function drawTxDots(b) {
  if (!operations.length || !pricePts.length) return;

  const xs = pricePts.map(p => p.t);
  const chartMinT = Math.min(...xs);
  const chartMaxT = Math.max(...xs);

  function nearestIdx(t) {
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      xs[mid] < t ? (lo = mid) : (hi = mid);
    }
    return Math.abs(xs[lo] - t) <= Math.abs(xs[hi] - t) ? lo : hi;
  }

  operations.forEach(op => {
    if (!op.created_at) return;
    const t = new Date(op.created_at).getTime();
    if (t < chartMinT || t > chartMaxT) return; // only show in current timeframe

    const i = nearestIdx(t);
    const px = b.xp(pricePts[i].t);
    const py = b.yp(pricePts[i].c);

    // Color logic
    let color;
    if (op.dir === 'in') {
      color = '#58b86a';      // green = incoming
    } else if (op.dir === 'out') {
      color = '#e15759';      // red = outgoing
    } else {
      color = '#facc15';      // yellow = self-send (from === to)
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();

    // Black outline for better visibility on any background
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}
function draw() {
  resize();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!pricePts.length) return;
  const b = computeBounds(pricePts);
  drawAxes(b);
  drawLine(pricePts, b);
  drawTxDots(b);
}

// Init & event listeners
document.addEventListener('DOMContentLoaded', () => {
  resize();

  loadPrice();
  loadHistory(365); // default to last year

  // Timeframe buttons — update days based on last 7 intervals
  document.querySelectorAll('.tabs .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const map = { D:7, W:49, M:210, Y:365, A:'max' }; // D=last 7 days, W=last 7 weeks, M=last 7 months (~210 days), Y=last year, A=all
      const days = map[btn.dataset.tf] || 365;
      TF = btn.dataset.tf;
      loadHistory(days);
    });
  });

  // Load wallet operations button
  document.getElementById('btnLoadTx').onclick = () => {
    const acct = document.getElementById('acct').value.trim().toUpperCase();
    if (!/^G[2-7A-Z0-9]{55}$/.test(acct)) {
      msg.textContent = 'Invalid Pi address (G..., 56 chars)';
      return;
    }
    loadWalletOperations(acct);
  };
});