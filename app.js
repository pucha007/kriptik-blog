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

// --- 2. Живые курсы BTC/ETH (public API, без ключей) ---
async function loadPrices() {
  const el = document.getElementById('prices');
  if (!el) return;
  try {
    const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]');
    if (!resp.ok) throw new Error();
    const rows = await resp.json();
    const fmt = n => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    el.innerHTML = rows.map(r => {
      const up = parseFloat(r.lastPrice) >= parseFloat(r.openPrice);
      const pct = ((parseFloat(r.lastPrice) - parseFloat(r.openPrice)) / parseFloat(r.openPrice) * 100).toFixed(2);
      return `<div class="price ${up ? 'up' : 'down'}">
        <span class="psym">${r.symbol.startsWith('BTC') ? '₿' : 'Ξ'} ${r.symbol.replace('USDT','')}</span>
        <span class="pval">$${fmt(r.lastPrice)}</span>
        <span class="ppct">${up ? '▲' : '▼'} ${pct}%</span>
      </div>`;
    }).join('');
    if (typeof window.__pricesLoaded === 'function') window.__pricesLoaded();
  } catch (e) {
    el.innerHTML = '<div class="loading">Курсы временно недоступны</div>';
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