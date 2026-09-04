# -*- coding: utf-8 -*-
"""
Агент-контент «Криптика»: наполняет блог на автопилоте.
1. Тянет свежие новости из RSS (Cointelegraph и др.)
2. Отбирает интересное про биткоин/крипту
3. Через ИИ (DeepSeek на polza.ai) делает короткую заметку на русском
4. Пишет в blog/posts.json (лента сайта)
Запускать по cron каждые N часов. Не требует ключей — берёт из .env.
"""
import os
import re
import sys
import json
import time
import html
import urllib.request
import urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))
# папка сайта-блога (одностаничник) — рядом с агентом: ../blog
BLOG_DIR = os.path.abspath(os.path.join(BASE, "..", "blog"))
POSTS_PATH = os.path.join(BLOG_DIR, "posts.json")
MAX_POSTS = 20          # сколько заметок держим на ленте
FRESH_HOURS = 48        # статьи не старше скольких часов берём в заметки
ENV_PATH = os.path.join(BASE, ".env")

RSS_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://coinjournal.net/feed/",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
]


def log(msg):
    ts = time.strftime("%m.%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def get_env(key, default=""):
    """Читает ключ из .env. Сначала свой .env, потом .env приложения (для DEEPSEEK_API_KEY)."""
    paths = [ENV_PATH, "/opt/kriptik/.env"]
    for p in paths:
        try:
            with open(p, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith(key + "="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    return default


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; KriptikBot/1.0)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_rss(xml):
    """Достаёт [ (title, link, pubDate) ] из RSS/Atom XML. Без внешних библиотек."""
    items = []
    # разделяем на <item> (RSS) или <entry> (Atom)
    for tag in ("item", "entry"):
        for m in re.finditer(r"<" + tag + r"[^>]*>(.*?)</" + tag + r">", xml, re.S):
            block = m.group(1)
            def field(name):
                fm = re.search(r"<" + name + r"[^>]*>(.*?)</" + name + r">", block, re.S)
                if fm:
                    return html.unescape(re.sub(r"<[^>]+>", "", fm.group(1))).strip()
                return ""
            items.append((field("title"), field("link"), field("pubDate")))
    return items


def parse_date(s):
    """pubDate → unix. Форматы RSS (RFC822) и Atom (ISO8601)."""
    s = s.strip()
    if not s:
        return 0
    try:
        return time.mktime(time.strptime(s, "%a, %d %b %Y %H:%M:%S %z")[:9])
    except Exception:
        pass
    try:
        return time.mktime(time.strptime(s, "%Y-%m-%dT%H:%M:%S%z")[:9])
    except Exception:
        pass
    try:
        return time.mktime(time.strptime(s, "%d %b %Y %H:%M:%S"))
    except Exception:
        pass
    return 0


def collect_news():
    """Собирает свежие новости из всех RSS, сортирует по времени (новые сверху)."""
    rows = []
    seen = set()
    now = time.time()
    for url in RSS_FEEDS:
        try:
            xml = fetch(url)
            for title, link, pub in parse_rss(xml):
                if not title or len(title) < 12:
                    continue
                key = title.lower()[:60]
                if key in seen:
                    continue
                seen.add(key)
                ts = parse_date(pub)
                if ts and (now - ts) > FRESH_HOURS * 3600:
                    continue
                rows.append({"title": title, "link": link, "ts": ts or now, "source": url.split("//")[1].split("/")[0]})
        except Exception as e:
            log(f"rss {url}: {e}")
    rows.sort(key=lambda r: r["ts"], reverse=True)
    return rows[:12]


def ai_summary(title, url):
    """Короткая заметка от ИИ (DeepSeek через polza.ai). Вернёт (заголовок, текст) или None."""
    key = get_env("DEEPSEEK_API_KEY")
    if not key:
        return None
    prompt = (
        "Ты — редактор крипто-блога. По заголовку новости напиши: "
        f"1) короткий заголовок заметки (до 70 символов, на русском), "
        f"2) резюме 1-2 предложения (до 200 символов), зачем это важно трейдеру. "
        f"Новость: «{title}» ({url}). "
        "Ответь строго в формате JSON: {\"title\":\"...\",\"summary\":\"...\"}"
    )
    try:
        req = urllib.request.Request(
            "https://api.polza.ai/v1/chat/completions", method="POST",
            data=json.dumps({
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "Ты краткий редактор крипто-новостей, отвечаешь только JSON."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 260,
                "temperature": 0.5,
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=45) as r:
            d = json.load(r)
        content = (d.get("choices") or [{}])[0].get("message", {}).get("content", "")
        m = re.search(r"\{.*\}", content, re.S)
        if not m:
            return None
        obj = json.loads(m.group(0))
        t = (obj.get("title") or "").strip()[:100]
        s = (obj.get("summary") or "").strip()[:300]
        if t and s:
            return t, s
    except Exception as e:
        log(f"ai: {e}")
    return None


# примитивный переводчик для fallback: англ. слова → русские (для заголовков новостей)
_RU_DICT = {
    "bitcoin": "Биткоин", "btc": "BTC", "ethereum": "Эфир", "eth": "ETH", "crypto": "крипто",
    "price": "цена", "market": "рынок", "trading": "торговля", "exchange": "биржа",
    "investor": "инвестор", "investors": "инвесторы", "fund": "фонд", "funds": "фонды",
    "regulator": "регулятор", "regulation": "регулирование", "lawsuit": "иск", "court": "суд",
    "sued": "подал иск", "lawsuit": "судится", "stablecoin": "стейблкоин", "token": "токен",
    "launch": "запуск", "launches": "запускает", "partners": "партнёр", "partnership": "партнёрство",
    "payments": "платежи", "payment": "платёж", "exchange": "биржа", "report": "отчёт",
    "reports": "сообщает", "reclaim": "отвоёвывает", "year": "год", "today": "сегодня",
    "what": "что", "happened": "произошло", "here": "вот", "analysis": "анализ",
    "bank": "банк", "banks": "банки", "ceo": "гендиректор", "bull": "бык", "bear": "медведь",
    "rally": "ралли", "crash": "обвал", "defi": "DeFi", "nft": "NFT", "million": "млн",
    "billion": "млрд", "collaboration": "сотрудничество", "care": "забота", "reserve": "резерв",
    "federal": "федеральный", "institutions": "институты",
}


def plain_summary(title):
    """Заметка без ИИ: заголовок + авто-резюме. Пытается перевести знакомые слова на русский."""
    t = html.unescape(title).strip()
    clean = re.split(r"\s[—–|-]\s", t)[0].strip()
    # лёгкий перевод знакомых слов
    words = clean.split()
    out = []
    for w in words:
        wc = w.strip(".,!?:;()'\"")
        low = wc.lower()
        if low in _RU_DICT:
            out.append(_RU_DICT[low])
        elif low in ("and", "with", "for", "the", "of", "to", "in", "on", "a", "an", "is", "are"):
            continue  # выбрасываем артикли/предлоги
        else:
            out.append(wc)
    clean = " ".join(out)[:100] or t[:100]
    summary = t[:260]
    return clean, summary


def load_posts():
    try:
        with open(POSTS_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else data.get("posts", [])
    except Exception:
        return []


def save_posts(posts):
    os.makedirs(BLOG_DIR, exist_ok=True)
    with open(POSTS_PATH, "w", encoding="utf-8") as f:
        json.dump({"posts": posts}, f, ensure_ascii=False, indent=2)
    log(f"сохранено {len(posts)} постов")


def main():
    now = time.time()
    posts = load_posts()
    old_keys = {(p.get("title") or "").lower()[:60] for p in posts}

    news = collect_news()
    log(f"собрано новостей: {len(news)}")

    added = 0
    for n in news:
        key = n["title"].lower()[:60]
        if key in old_keys:
            continue
        res = ai_summary(n["title"], n["link"])
        if not res:
            # нет ИИ-ключа (или он не отвечает) — пишем заметку без ИИ, автопилот работает
            res = plain_summary(n["title"])
            log("(fallback без ИИ)")
        title, summary = res
        posts.insert(0, {
            "title": title,
            "summary": summary,
            "date": time.strftime("%Y-%m-%d", time.localtime(n["ts"])),
            "link": n["link"],
        })
        old_keys.add(key)
        added += 1
        log(f"добавлено: {title[:60]}")
        if added >= 3:
            break
        time.sleep(2)  # пауза между ИИ-запросами (избегаем 429)

    if added:
        # держим ленту не длиннее MAX_POSTS
        posts = posts[:MAX_POSTS]
        save_posts(posts)
        # если есть Telegram-токен — анонс в личку
        tok = get_env("TELEGRAM_BOT_TOKEN")
        chat = get_env("TELEGRAM_CHAT_ID")
        if tok and chat and added:
            try:
                text = f"📰 «Криптик» написал {added} новых заметки(ей) в блог!"
                body = urllib.parse.urlencode({"chat_id": chat, "text": text}).encode()
                urllib.request.urlopen(f"https://api.telegram.org/bot{tok}/sendMessage", data=body, timeout=15)
            except Exception:
                pass
    else:
        log("новых заметок нет")


if __name__ == "__main__":
    main()