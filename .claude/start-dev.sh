#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/Library/pnpm:$PATH"
cd "$(dirname "$0")/.."
pnpm start --host 0.0.0.0
