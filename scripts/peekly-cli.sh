#!/usr/bin/env bash
# Peekly CLI — installé via : ln -sf $(pwd)/scripts/peekly-cli.sh ~/.local/bin/peekly
set -euo pipefail

ROOT="/Users/rso/Projects/peekly"
SPRINT_LOG="$ROOT/docs/SPRINT_LOG.md"

BOLD='\033[1m'
NC='\033[0m'
C_GREEN='\033[92m'
C_CYAN='\033[96m'
C_GRAY='\033[90m'
C_RED='\033[91m'
C_YELLOW='\033[93m'

usage() {
  printf "\n${BOLD}peekly${NC} — CLI développement\n\n"
  printf "  ${BOLD}${C_GREEN}%-24s${NC}  %s\n" "peekly log \"desc\""   "Ajouter un point au sprint log"
  printf "  ${BOLD}${C_GREEN}%-24s${NC}  %s\n" "peekly status"         "Voir les items en attente d'analyse"
  printf "  ${BOLD}${C_GREEN}%-24s${NC}  %s\n" "peekly open"           "Ouvrir le projet dans Finder"
  printf "\n"
  printf "  ${C_GRAY}Skills Claude Code : /log-peekly · /sprint-peekly${NC}\n\n"
}

case "${1:-help}" in
  log)
    shift
    if [[ $# -eq 0 ]]; then
      printf "${C_RED}Usage : peekly log \"description\"${NC}\n" >&2
      exit 1
    fi
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
    SPRINT_ENTRY="- [ ] [$TIMESTAMP] $*" python3 - "$SPRINT_LOG" <<'PYEOF'
import sys, os
f = sys.argv[1]
entry = os.environ['SPRINT_ENTRY']
marker = "<!-- Les nouvelles entrées s'ajoutent automatiquement ici via `log-peekly` -->"
content = open(f).read()
new_content = content.replace(marker, marker + '\n' + entry, 1)
open(f, 'w').write(new_content)
PYEOF
    COUNT=$(grep -c "^- \[ \]" "$SPRINT_LOG" 2>/dev/null || echo 0)
    printf "${C_GREEN}✓ Peekly Sprint log — ajouté :${NC} \"%s\"\n" "$*"
    printf "  ${C_GRAY}En attente d'analyse : %s point(s)${NC}\n" "$COUNT"
    printf "  ${C_GRAY}Fichier : Projects/peekly/docs/SPRINT_LOG.md${NC}\n"
    ;;
  status|st)
    COUNT=$(grep -c "^- \[ \]" "$SPRINT_LOG" 2>/dev/null || echo 0)
    IN_PROGRESS=$(grep -c "^- \[~\]" "$SPRINT_LOG" 2>/dev/null || echo 0)
    printf "\n${BOLD}Peekly Sprint Log${NC}\n"
    printf "  ${C_YELLOW}En attente  :${NC} %s item(s)\n" "$COUNT"
    printf "  ${C_CYAN}En cours    :${NC} %s item(s)\n" "$IN_PROGRESS"
    printf "  ${C_GRAY}→ /sprint-peekly pour analyser et planifier${NC}\n\n"
    ;;
  open|o)
    open "$ROOT"
    ;;
  --help|-h|help|"")
    usage
    ;;
  --version|-v|version)
    printf "peekly CLI — %s\n" "$ROOT"
    ;;
  *)
    printf "${C_RED}Commande inconnue : %s${NC}\n" "$1" >&2
    usage >&2
    exit 1
    ;;
esac
