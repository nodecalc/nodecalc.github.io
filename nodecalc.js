// nodecalc.js - Pi Node Profit Calculator (2026 edition)
// For https://nodecalc.github.io/

console.log("Pi Node Calculator - Modern 2026 version loaded");

const $ = id => document.getElementById(id);

// ── State & Constants ───────────────────────────────────────────────
let currentCurrency = 'USD';
let originalUsdPiPrice = 0.60; // fallback 2026-ish value

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', PHP: '₱', VND: '₫',
  KRW: '₩', IDR: 'Rp', INR: '₹', NGN: '₦'
};

const STATIC_FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,   PHP: 58,
  VND: 25400,  KRW: 1420,
  IDR: 16200,  INR: 86,
  NGN: 1650
};

let exchangeRates = { ...STATIC_FALLBACK_RATES };

// ── DOM Elements ─────────────────────────────────────────────────────
const els = {
  base:         $('base'),
  boostPct:     $('boostPct'),
  rewardOff:    $('rewardOff'),

  kwhSlider:    $('kwhSlider'),     kwhValue:    $('kwhValue'),
  wattsSlider:  $('wattsSlider'),   wattsValue:  $('wattsValue'),
  nodeSlider:   $('nodeBonusSlider'), nodeValue:  $('nodeBonusValue'),

  kwhHidden:    $('kwh'),
  wattsHidden:  $('watts'),
  nodeHidden:   $('nodeBonus'),

  preview:      $('nodeExtraPreview'),
  piPrice:      $('piPrice'),
  piMeta:       $('piPriceMeta'),
  output:       $('out'),
  elecLabel:    $('elecLabel'),
  piPriceLabel: $('piPriceLabel'),

  statusDot:    $('status-dot'),
  statusText:   $('status-text')
};

// ── Helpers ──────────────────────────────────────────────────────────
function getSymbol() {
  return CURRENCY_SYMBOLS[currentCurrency] || '$';
}

function usdToLocal(usd) {
  return usd * (exchangeRates[currentCurrency] || 1);
}

function formatLocal(usd, decimals = 2) {
  return getSymbol() + usdToLocal(usd).toFixed(decimals);
}

// ── UI Updates ───────────────────────────────────────────────────────
function updateSlider(slider, displayEl, suffix = '') {
  const v = parseFloat(slider.value) || 0;
  const pct = ((v - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty('--progress', pct + '%');

  if (slider === els.kwhSlider) {
    displayEl.textContent = formatLocal(v) + '/kWh';
  } else if (suffix === '×') {
    displayEl.textContent = v.toFixed(1) + '×';
  } else if (suffix) {
    displayEl.textContent = Math.round(v) + suffix;
  } else {
    displayEl.textContent = v.toFixed(2);
  }

  // Sync hidden inputs (used by share image)
  els.kwhHidden.value   = els.kwhSlider.value;
  els.wattsHidden.value = els.wattsSlider.value;
  els.nodeHidden.value  = els.nodeSlider.value;
}

function updatePriceDisplay() {
  const rate = exchangeRates[currentCurrency];
  els.piPrice.value = (originalUsdPiPrice * rate).toFixed(4);
}

function updatePreview() {
  const base  = Number(els.base.value) || 0;
  const boost = (Number(els.boostPct.value) || 0) / 100;
  const node  = Number(els.nodeHidden.value) || 0;

  const extra = base * boost * node * 24;
  els.preview.textContent = `Node adds ≈ +${extra.toFixed(3)} π/day`;
}

// ── Core Calculation ─────────────────────────────────────────────────
function calculate() {
  const base     = Number(els.base.value)      || 0;
  const boost    = (Number(els.boostPct.value) || 0) / 100;
  const rewards  = Number(els.rewardOff.value) || 0;
  const nodeMult = Number(els.nodeHidden.value)|| 0;

  const watts    = Number(els.wattsHidden.value) || 60;
  const kwhUsd   = Number(els.kwhHidden.value)  || 0.18;

  const withoutNode = base * boost * rewards * 24;
  const withNode    = base * boost * (rewards + nodeMult) * 24;
  const extraPi     = withNode - withoutNode;

  const elecCostUsd = (watts * 24 / 1000) * kwhUsd;
  const netUsd      = extraPi * originalUsdPiPrice - elecCostUsd;

  els.output.innerHTML = `
    <div class="result-row"><b>Without node</b><br>${withoutNode.toFixed(3)} π/day</div>
    <div class="result-row"><b>With node</b><br>${withNode.toFixed(3)} π/day</div>
    <div class="result-row"><div class="big-number">+${extraPi.toFixed(3)} π/day</div></div>
    <div class="result-row"><b>Electricity</b><br>${formatLocal(elecCostUsd)}/day</div>
    <div class="result-row"><b>Result</b><br>
      <span class="${netUsd >= 0 ? 'good' : 'bad'}">
        ${netUsd >= 0 ? 'Profit' : 'Loss'}: ${formatLocal(netUsd)}/day
      </span>
    </div>
  `;
}

// ── Currency Switch ──────────────────────────────────────────────────
function setCurrency(code) {
  currentCurrency = code;

  document.querySelectorAll('.curr-btn').forEach(b => {
    b.classList.toggle('active', b.id === `curr-${code}`);
  });

  els.piPriceLabel.textContent = `Estimated Pi price (${getSymbol()})`;
  els.elecLabel.textContent    = `Electricity cost (${getSymbol()}/kWh)`;

  updatePriceDisplay();
  updateSlider(els.kwhSlider, els.kwhValue); // refresh electricity display
  calculate();
}

// ── Live Data ────────────────────────────────────────────────────────
async function loadLivePiPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd');
    const data = await res.json();
    if (data?.['pi-network']?.usd > 0) {
      originalUsdPiPrice = data['pi-network'].usd;
      updatePriceDisplay();

      const t = new Date();
      const time = t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0');
      els.piMeta.textContent = `Live: $${originalUsdPiPrice.toFixed(4)} (as of ${time})`;
      calculate();
    }
  } catch {
    els.piMeta.textContent = 'Live price unavailable – using fallback';
  }
}

async function loadExchangeRates() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    if (data?.rates) {
      Object.assign(exchangeRates, data.rates);
      console.log("→ Live FX rates loaded");
    }
  } catch {
    console.log("→ Using static exchange rates");
  }
  updatePriceDisplay();
  calculate();
}

// ── picrumbs.online Status ───────────────────────────────────────────
async function checkPicrumbsStatus() {
  if (!els.statusDot || !els.statusText) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const start = Date.now();
    await fetch('https://picrumbs.online/', {
      method: 'HEAD',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const took = Date.now() - start;
    const isFast = took < 2200;

    els.statusDot.style.background = isFast ? '#22c55e' : '#f59e0b';
    els.statusText.textContent = isFast ? 'online' : 'slow';
    els.statusText.style.color = isFast ? '#15803d' : '#92400e';

  } catch {
    els.statusDot.style.background = '#ef4444';
    els.statusText.textContent = 'offline';
    els.statusText.style.color = '#991b1b';
  }
}

// ── Share Image Generation ───────────────────────────────────────────
function generateShareImage() {
  const base     = Number(els.base.value)      || 0;
  const boost    = Number(els.boostPct.value)  || 0;
  const rewards  = Number(els.rewardOff.value) || 0;
  const node     = Number(els.nodeHidden.value)|| 0;
  const kwhUsd   = Number(els.kwhHidden.value) || 0.18;
  const watts    = Number(els.wattsHidden.value)|| 60;

  const rate = exchangeRates[currentCurrency];
  const symbol = getSymbol();

  const piPriceDisp = Number(els.piPrice.value) || (originalUsdPiPrice * rate);

  const without = (base * (boost/100) * rewards * 24).toFixed(3);
  const withN   = (base * (boost/100) * (rewards + node) * 24).toFixed(3);
  const extra   = (Number(withN) - Number(without)).toFixed(3);

  const elec    = ((watts * 24 / 1000) * kwhUsd * rate).toFixed(2);
  const net     = (Number(extra) * piPriceDisp - Number(elec)).toFixed(2);

  const verdict = Number(net) >= 0
    ? `Profit: +${symbol}${net}/day`
    : `Loss: ${symbol}${net}/day`;

  const data = {
    base:     base.toFixed(6),
    boost:    boost.toFixed(2),
    rewards:  rewards.toFixed(2),
    nodeBonus: node.toFixed(1),
    kwh:      `${symbol}${(kwhUsd * rate).toFixed(2)}`,
    watts:    watts,
    piPrice:  piPriceDisp.toFixed(4),
    off:      without,
    on:       withN,
    elec:     `${symbol}${elec}/day`,
    verdict
  };

  renderImage(data);
}

function renderImage(d) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1620;
  const ctx = canvas.getContext('2d');

  const bg = new Image();
  bg.crossOrigin = "anonymous";
  bg.src = './results.jpg';

  bg.onload = () => {
    ctx.drawImage(bg, 0, 0, 1080, 1620);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#333';

    ctx.font = 'bold 30px system-ui';
    ctx.fillText(d.base,    158, 393);
    ctx.fillText(d.boost+'%', 350, 393);
    ctx.fillText(d.rewards, 525, 393);

    ctx.font = 'bold 38px system-ui';
    ctx.fillText(d.nodeBonus+'×', 350, 600);

    ctx.font = 'bold 32px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(d.kwh,       260, 876);
    ctx.fillText(d.watts+' W',260,1055);

    ctx.textAlign = 'center';
    ctx.font = 'bold 32px system-ui';
    ctx.fillText(`${getSymbol()}${d.piPrice}`, 645, 815);

    ctx.font = 'bold 30px system-ui';
    ctx.fillText(d.off + ' π/day', 760, 1198);
    ctx.fillText(d.on  + ' π/day', 760, 1290);
    ctx.fillText(d.elec,           760, 1375);

    const netVal = parseFloat(d.verdict.replace(/[^0-9.-]/g,''));
    ctx.fillStyle = netVal >= 0 ? '#1f8f55' : '#b63a3a';
    ctx.font = 'bold 40px system-ui';
    ctx.fillText(d.verdict, 760, 1489);

    ctx.fillStyle = '#999';
    ctx.font = '32px system-ui';
    ctx.fillText('picrumbs.online by Bulbybot', 790, 1550);

    const link = document.createElement('a');
    link.download = 'PiNodeCalc_result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
}

// ── Event Listeners & Init ───────────────────────────────────────────
function setupListeners() {
  els.kwhSlider.addEventListener('input', () => {
    updateSlider(els.kwhSlider, els.kwhValue);
    calculate();
  });

  els.wattsSlider.addEventListener('input', () => {
    updateSlider(els.wattsSlider, els.wattsValue, ' W');
    calculate();
  });

  els.nodeSlider.addEventListener('input', () => {
    updateSlider(els.nodeSlider, els.nodeValue, '×');
    updatePreview();
    calculate();
  });

  [els.base, els.boostPct, els.rewardOff].forEach(input => {
    input.addEventListener('input', () => {
      updatePreview();
      calculate();
    });
  });

  document.querySelectorAll('.curr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrency(btn.id.replace('curr-', ''));
    });
  });
}

async function init() {
  if (!els.base || !els.output) {
    console.warn("Some critical DOM elements are missing!");
    return;
  }

  setupListeners();

  // Initial UI state
  updateSlider(els.kwhSlider,   els.kwhValue);
  updateSlider(els.wattsSlider, els.wattsValue, ' W');
  updateSlider(els.nodeSlider,  els.nodeValue,  '×');

  updatePreview();

  // Default currency
  setCurrency('USD');

  // Load external data
  await Promise.allSettled([
    loadLivePiPrice(),
    loadExchangeRates()
  ]);

  // picrumbs status
  checkPicrumbsStatus();

  // Optional periodic check
  // setInterval(checkPicrumbsStatus, 60000);
}

window.addEventListener('load', init);