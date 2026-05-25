#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
export PATH="$HOME/Library/pnpm:$PATH"
cd "$(dirname "$0")/.."
pnpm start --host 0.0.0.0
