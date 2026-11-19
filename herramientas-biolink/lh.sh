#!/bin/bash
# Uso: ./lh.sh <url> <nombre> [mobile|desktop]
FF=${3:-mobile}
EXTRA=""; [ "$FF" = desktop ] && EXTRA="--preset=desktop"
CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx lighthouse "$1" --quiet --chrome-flags="--headless=new --no-sandbox" --output=json --output=html --output-path=salida/lighthouse/$2 $EXTRA >/dev/null 2>&1
node -e "
const r=require('./salida/lighthouse/$2.report.json');const a=r.audits;
console.log('$2', Object.values(r.categories).map(c=>c.id+':'+Math.round(c.score*100)).join(' '), '| LCP', a['largest-contentful-paint'].displayValue, '| FCP', a['first-contentful-paint'].displayValue, '| CLS', a['cumulative-layout-shift'].displayValue, '| TBT', a['total-blocking-time'].displayValue);
"
