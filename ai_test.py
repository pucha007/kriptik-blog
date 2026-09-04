import os, json, urllib.request
key = ""
for line in open('/opt/kriptik/.env', encoding='utf-8'):
    line = line.strip()
    if line.startswith("DEEPSEEK_API_KEY="):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")
print("ключ найден:", bool(key))
if key:
    req = urllib.request.Request("https://api.polza.ai/v1/chat/completions", method="POST",
        data=json.dumps({"model":"deepseek-chat",
            "messages":[{"role":"user","content":"Ответь одним словом по-русски: тест"}],
            "max_tokens":20}).encode(),
        headers={"Content-Type":"application/json","Authorization":f"Bearer {key}"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=45))
        print("ИИ отвечает:", (d.get("choices") or [{}])[0].get("message",{}).get("content","")[:60])
    except Exception as e:
        print("ИИ ОШИБКА:", repr(e)[:200])
