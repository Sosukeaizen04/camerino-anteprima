#!/bin/zsh
# Una volta sola, dopo "npx wrangler login": crea la memoria (KV), chiede la chiave di fal e pubblica il server.
set -e
cd ${0:a:h}
if grep -q 'id = "KV_ID"' wrangler.toml; then
  id=$(npx -y wrangler@4 kv namespace create MEMORIA 2>&1 | grep -oE '[0-9a-f]{32}' | head -1)
  [ -z "$id" ] && { echo "Non sono riuscito a creare la memoria KV"; exit 1; }
  sed -i '' "s/id = \"KV_ID\"/id = \"$id\"/" wrangler.toml
  echo "Memoria creata."
fi
echo "Incolla la chiave di fal (non si vede mentre la incolli), poi Invio:"
npx -y wrangler@4 secret put FAL_KEY
npx -y wrangler@4 deploy
