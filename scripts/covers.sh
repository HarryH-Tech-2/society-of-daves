#!/usr/bin/env bash
# Renders blog cover / share images from scripts/cover.html into
# public/images/covers/. Needs the agent-browser CLI (npm i -g agent-browser).
# Usage: bash scripts/covers.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/images/covers
template="file:///$(pwd -W 2>/dev/null || pwd)/scripts/cover.html"

enc() { node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$1"; }

render() { # slug, title, top line, badge name
  agent-browser open "$template?title=$(enc "$2")&top=$(enc "$3")&name=$(enc "$4")" >/dev/null
  agent-browser wait 900 >/dev/null
  agent-browser screenshot "public/images/covers/$1.png" >/dev/null
  echo "public/images/covers/$1.png"
}

agent-browser open "about:blank" >/dev/null
agent-browser set viewport 1200 630 >/dev/null

render gifts-for-daves               "Gifts for Daves: 25 ideas for the Dave in your life" "HO HO HO" "Dave"
render what-does-the-name-dave-mean  "What does the name Dave mean?"                       "HELLO"    "Beloved"
render how-popular-is-the-name-david "How popular is the name David?"                      "HELLO"    "3.7 million"
render famous-daves                  "Famous Daves: the most notable people called Dave"   "HELLO"    "Famous"
render david-in-other-languages      "David in other languages"                            "HELLO"    "Dafydd"
render st-davids-day                 "St David's Day: a guide for every Dave"              "HELLO"    "Dewi"
render gift                          "Give a Dave a year of being a Dave"                   "HO HO HO" "Dave"

agent-browser close >/dev/null || true
