#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерирует stats.json для блога из журнала сделок бота и пушит в git."""
import os, json, time, sys, subprocess

BASE = "/opt/kblog"
JOURNAL = "/opt/kriptik/trades_journal.csv"


def read_journal():
    if not os.path.exists(JOURNAL):
        return []
    rows = []
    try:
        with open(JOURNAL, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                if line.lower().startswith(("symbol", "время", "#")):
                    continue
                rows.append(line)
    except Exception as e:
        print("journal err:", e)
    return rows


def main():
    rows = read_journal()
    trades = 0
    wins = 0
    total_pnl = 0.0
    best = 0.0
    for r in rows:
        p = r.split(",")
        if len(p) >= 11:
            try:
                pnl = float(p[9])
                total_pnl += pnl
                trades += 1
                if pnl > 0:
                    wins += 1
                if pnl > best:
                    best = pnl
            except Exception:
                pass
    winrate = (wins / trades * 100) if trades else None
    stats = {
        "trades": trades,
        "winrate": round(winrate, 1) if winrate is not None else None,
        "pnl": round(total_pnl, 2),
        "best": round(best, 2),
        "updated": time.strftime("%Y-%m-%d %H:%M"),
    }
    path = os.path.join(BASE, "stats.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print("stats:", stats)

    # коммит и пуш
    env = dict(os.environ)
    env["GIT_SSH_COMMAND"] = "ssh -i /root/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new"
    try:
        subprocess.run(["git", "add", "stats.json"], cwd=BASE, env=env, capture_output=True)
        subprocess.run(["git", "-c", "user.name=Kriptik Bot",
                        "-c", "user.email=kriptik-bot@users.noreply.github.com",
                        "commit", "-m", "stats.json", "--no-edit"], cwd=BASE, env=env, capture_output=True)
        r = subprocess.run(["git", "push"], cwd=BASE, env=env, capture_output=True)
        print("push:", r.returncode)
    except Exception as e:
        print("git err:", e)


if __name__ == "__main__":
    main()