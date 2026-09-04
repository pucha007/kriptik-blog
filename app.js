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

// --- 3. Цели Метрики: прокрутка до конца + 30 сек на сайте ---
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

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// --- 4. Запуск ---
loadFeed();
loadPrices();
setInterval(loadFeed, 10 * 60 * 1000);   // обновляем ленту
setInterval(loadPrices, 60 * 1000);      // обновляем курсы