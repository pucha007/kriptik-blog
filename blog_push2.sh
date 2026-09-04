#!/bin/bash
cd /opt/kblog
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new"
git add -A
git -c user.name="Kriptik Bot" -c user.email="kriptik-bot@users.noreply.github.com" commit -m "Publish posts by agent" 2>&1 || echo "(nothing to commit)"
git push 2>&1
echo "PUSH=$?"