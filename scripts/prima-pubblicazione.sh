#!/bin/zsh
# Una volta sola: crea su GitHub il progetto vero (privato) e la copia di anteprima (pubblica, con pagina web).
set -e
cd ~/dev/camerino && gh repo create camerino --private --source=. --push
cd ~/dev/camerino-anteprima && gh repo create camerino-anteprima --public --source=. --push
gh api -X POST repos/Sosukeaizen04/camerino-anteprima/pages -f "source[branch]=main" -f "source[path]=/" >/dev/null
echo "Fatto. Tra 1-2 minuti il link funziona: https://sosukeaizen04.github.io/camerino-anteprima/"
