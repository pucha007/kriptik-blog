// ===== «КРИПТИК» — живость сайта =====

// --- 1. Лента новостей (агент на VPS наполняет posts.json) ---
async function loadFeed() {
  const el = document.getElementById('feed');
  try {
    const resp = await fetch('posts.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error('posts.json недоступен: ' + resp.status);
    const data = await resp.json();
    const posts = Array.isArray(data) ? data : (data.posts || []);
    if (!posts.length) {
      el.innerHTML = '<div class="loading">Пока нет записей — агент пишет первые заметки…</div>';
      return;
    }
    el.innerHTML = posts.map(p => `
      <div class="card">
        <div class="date">${esc(p.date || '')}</div>
        <h3>${esc(p.title || 'Без заголовка')}</h3>
        <p>${esc(p.summary || '')}</p>
        ${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="news-link" data-title="${esc(p.title)}">Читать источник →</a>` : ''}
      </div>
    `).join('');
    // Цель Метрики: клик по ссылке новости
    document.querySelectorAll('.news-link').forEach(a => {
      a.addEventListener('click', () => {
        try { ym(112280241, 'reachGoal', 'news_click'); } catch(e) {}
      });
    });
  } catch (e) {
    el.innerHTML = '<div class="loading">Не удалось загрузить ленту. Попробуй позже.</div>';
    console.error(e);
  }
}

// --- 2. Живые курсы BTC/ETH (двойной источник: Binance → CoinGecko) ---
async function loadPrices() {
  const el = document.getElementById('prices');
  if (!el) return;
  try {
    let rows = null;
    // сначала Binance (быстрый, детальный)
    try {
      const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]', { timeout: 8000 });
      if (resp.ok) {
        const arr = await resp.json();
        rows = arr.map(r => ({
          sym: r.symbol.startsWith('BTC') ? '₿ BTC' : 'Ξ ETH',
          last: parseFloat(r.lastPrice),
          open: parseFloat(r.openPrice)
        }));
      }
    } catch (e) {}
    // fallback: CoinGecko (работает почти везде)
    if (!rows) {
      const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
      if (resp.ok) {
        const d = await resp.json();
        rows = [
          { sym: '₿ BTC', last: d.bitcoin.usd, open: null, chg: d.bitcoin.usd_24h_change },
          { sym: 'Ξ ETH', last: d.ethereum.usd, open: null, chg: d.ethereum.usd_24h_change },
        ];
      }
    }
    if (!rows) throw new Error('нет данных');
    const fmt = n => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    el.innerHTML = rows.map(r => {
      const chg = (r.chg != null)
        ? r.chg
        : (r.open ? ((r.last - r.open) / r.open * 100) : 0);
      const up = chg >= 0;
      return `<div class="price ${up ? 'up' : 'down'}">
        <span class="psym">${r.sym}</span>
        <span class="pval">$${fmt(r.last)}</span>
        <span class="ppct">${up ? '▲' : '▼'} ${chg.toFixed(2)}%</span>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="loading">Курсы временно недоступны (без VPN)</div>';
  }
}

// --- 2.5 Fear & Greed Index ---
async function loadFNG() {
  const el = document.getElementById('fngBox');
  if (!el) return;
  // ретраи: если первый запрос сорвался (VPN/сеть), пробуем ещё
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const resp = await fetch('https://api.alternative.me/fng/?limit=1', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error('fng статус ' + resp.status);
      const d = await resp.json();
      const v = parseInt(d.data[0].value, 10);
      const cls = v >= 60 ? 'up' : v <= 40 ? 'down' : '';
      el.className = 'price ' + cls;
      const labels = { 0:'😱 Паника', 25:'😨 Страх', 50:'😐 Нейтрально', 75:'😃 Жадность', 100:'🚀 Эйфория' };
      let label = '';
      for (const [k, l] of Object.entries(labels)) {
        if (v >= Number(k)) label = l;
      }
      el.innerHTML = `<span class="psym">😱 Fear &amp; Greed</span>
        <span class="pval">${v}/100</span>
        <span class="ppct">${label}</span>`;
      return;
    } catch (e) {
      console.warn('fng попытка ' + attempt + ':', e);
      if (attempt === 2) {
        el.innerHTML = '<div class="loading">Индекс временно недоступен — обнови страницу 🔄</div>';
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
}

// --- 2.6 СТАТИСТИКА бота (stats.json обновляет cron на VPS) ---
async function loadStats() {
  const el = document.getElementById('statsGrid');
  if (!el) return;
  try {
    const resp = await fetch('stats.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error('stats.json недоступен');
    const s = await resp.json();
    const pnl = Number(s.pnl || 0);
    document.getElementById('statTrades').textContent = s.trades ?? '—';
    const pnlEl = document.getElementById('statPnl');
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '$';
    pnlEl.className = pnl >= 0 ? 'pnl green' : 'pnl red';
    document.getElementById('svTrades').textContent = s.trades ?? '—';
    document.getElementById('svWin').textContent = (s.winrate != null ? s.winrate.toFixed(0) + '%' : '—');
    const pnlCard = document.getElementById('svPnl');
    pnlCard.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '$';
    pnlCard.className = 'sv ' + (pnl >= 0 ? 'green' : 'red');
    document.getElementById('svBest').textContent = s.best != null ? '+' + s.best.toFixed(2) + '$' : '—';
  } catch (e) {
    console.warn('нет stats.json:', e);
  }
}

// --- 3. Тема: тёмная / светлая ---
function initTheme() {
  const t = document.getElementById('themeToggle');
  if (!t) return;
  const saved = localStorage.getItem('kriptik_theme');
  if (saved === 'light') document.body.classList.add('light');
  t.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
  t.addEventListener('click', () => {
    document.body.classList.toggle('light');
    t.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
    localStorage.setItem('kriptik_theme', document.body.classList.contains('light') ? 'light' : 'dark');
    try { ym(112280241, 'reachGoal', 'theme_click'); } catch(e) {}
  });
}

// --- 4. Цели Метрики: прокрутка до конца + 30 сек на сайте ---
function trackScroll() {
  const target = document.body.scrollHeight - window.innerHeight - 120;
  if (window.scrollY >= target) {
    try { ym(112280241, 'reachGoal', 'scroll_end'); } catch(e) {}
    window.removeEventListener('scroll', trackScroll);
  }
}
window.addEventListener('scroll', trackScroll);

setTimeout(() => {
  try { ym(112280241, 'reachGoal', 'time_30s'); } catch(e) {}
}, 30000);

// клик по партнёрке
document.addEventListener('click', e => {
  const a = e.target.closest ? e.target.closest('a[href*="bitget.com"]') : null;
  if (a) { try { ym(112280241, 'reachGoal', 'bitget_click'); } catch(err) {} }
});

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// --- 5. Запуск ---
initTheme();
loadFeed();
loadPrices();
loadFNG();
loadStats();
setInterval(loadFeed, 10 * 60 * 1000);   // обновляем ленту
setInterval(loadPrices, 60 * 1000);      // обновляем курсы
setInterval(loadFNG, 10 * 60 * 1000);    // обновляем индекс
setInterval(loadStats, 5 * 60 * 1000);   // обновляем статистику