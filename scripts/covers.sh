#!/usr/bin/env bash
# Renders blog cover / share images from scripts/cover.html into
# public/images/covers/. Needs the agent-browser CLI (npm i -g agent-browser).
# Usage: bash scripts/covers.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/images/covers
template="file:///$(pwd -W 2>/dev/null || pwd)/scripts/cover.html"

enc() { node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$1"; }

render() { # slug, title, top line, badge name, theme
  agent-browser open "$template?title=$(enc "$2")&top=$(enc "$3")&name=$(enc "$4")&theme=$(enc "${5:-classic}")" >/dev/null
  agent-browser wait 900 >/dev/null
  agent-browser screenshot "public/images/covers/$1.png" >/dev/null
  echo "public/images/covers/$1.png"
}

agent-browser open "about:blank" >/dev/null
agent-browser set viewport 1200 630 >/dev/null

render why-is-d-called-david-cyberpunk-edgerunners-2 "Why is D called David in Cyberpunk: Edgerunners 2?" "HELLO" "D." cyber
render gifts-for-daves               "Gifts for Dave: 30 ideas for anyone called Dave or David" "HO HO HO" "Dave"        gifts
render what-does-the-name-dave-mean  "What does the name Dave mean?"                       "HELLO"    "Beloved"     meaning
render how-popular-is-the-name-david "How many Davids are there in the world?"             "HELLO"    "13 million"  numbers
render famous-daves                  "Famous Daves: the most notable people called Dave"   "HELLO"    "Famous"      famous
render david-in-other-languages      "David in Welsh is Dafydd: David in other languages"  "HELLO"    "Dafydd"      languages
render st-davids-day                 "St David's Day 2027: Monday 1 March"                 "HELLO"    "Dewi"        wales
render gift                          "Give a Dave a year of being a Dave"                   "HO HO HO" "Dave"        gift

agent-browser close >/dev/null || true
