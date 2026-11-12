#!/bin/zsh
# Una volta sola: la pagina web si pubblica dall'automazione (catalogo notturno) invece che dal ramo main.
set -e
gh api -X PUT repos/Sosukeaizen04/camerino-anteprima/pages -f build_type=workflow >/dev/null
gh workflow run catalogo.yml -R Sosukeaizen04/camerino-anteprima
echo "Fatto: automazione attiva, primo giro partito. Si segue da https://github.com/Sosukeaizen04/camerino-anteprima/actions"
