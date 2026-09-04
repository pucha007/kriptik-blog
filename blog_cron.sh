#!/bin/bash
# Автопилот блога «Криптик»: агент пишет посты → git push → сайт обновится сам
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new"
cd /opt/kblog

# 1. Агент-контент наполняет posts.json (RSS-новости → заметки)
/opt/kriptik/venv/bin/python /opt/kblog/agent_writer.py >> /opt/kblog/blog_agent.log 2>&1

# 2. Если что-то изменилось — коммитим и пушим (сайт обновится)
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git -c user.name="Kriptik Bot" -c user.email="kriptik-bot@users.noreply.github.com" commit -m "Автопост $(date '+%d.%m %H:%M')" >/dev/null 2>&1
  git push 2>&1 >> /opt/kblog/blog_agent.log
  echo "[$(date '+%d.%m %H:%M')] автоматом залил новый контент" >> /opt/kblog/blog_agent.log
fi