#!/bin/bash
set -e
cd /opt/kblog
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new"

git init -b main 2>/dev/null || git init -b main
git config user.name "Kriptik Bot"
git config user.email "kriptik-bot@users.noreply.github.com"

git add -A
git commit -m "v1: блог Криптика онлайн" 2>&1 || echo " (нечего коммитить)"
git remote remove origin 2>/dev/null || true
git remote add origin git@github.com:pucha007/kriptik-blog.git
git push -u origin main 2>&1
echo "PUSH_EXIT=$?"