#!/bin/zsh
# Copia la versione attuale nel progetto pubblico (quello con la pagina web) e la pubblica.
# Il catalogo non si copia: lo rifà GitHub ogni notte e a ogni pubblicazione (.github/workflows/catalogo.yml).
set -e
DEV=${0:a:h:h}; ANT=~/dev/camerino-anteprima
rsync -a --delete --exclude .git --exclude README.md --exclude robots.txt --exclude .cache --exclude .venv \
  --exclude __pycache__ --exclude data "$DEV/" "$ANT/"
cd "$ANT" && git add -A && git commit -qm "anteprima: versione del $(date +%d/%m\ %H:%M)" && git push -q
echo "Inviata. Tra 5-10 minuti (catalogo + pubblicazione) è online: https://sosukeaizen04.github.io/camerino-anteprima/"
