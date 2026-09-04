// Лента новостей: читает posts.json (его наполняет агент-контент на VPS)
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
        ${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">Читать источник →</a>` : ''}
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = '<div class="loading">Не удалось загрузить ленту. Попробуй позже.</div>';
    console.error(e);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

loadFeed();
// обновляем ленту каждые 10 минут (агент пишет новые заметки)
setInterval(loadFeed, 10 * 60 * 1000);