#!/bin/bash
cd "/home/fabian-stamminger/Dokumente/Virtual Marketer/virtual-marketer.de Website"
S=/tmp/claude-1000/-home-fabian-stamminger-Dokumente-Virtual-Marketer-virtual-marketer-de-Website/d5b12633-a8d6-439b-ace8-3401b57c853b/scratchpad
node_modules/.bin/lighthouse "$1" --quiet --output=json --output-path="$S/lh-$2.json" \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate >/dev/null 2>&1
node -e "
const r=require('$S/lh-$2.json');const c=r.categories;const a=r.audits;
const s=k=>Math.round(c[k].score*100);const m=k=>a[k]?(a[k].displayValue||''):'';
console.log('$2'.padEnd(10),'Perf',String(s('performance')).padStart(3),'A11y',String(s('accessibility')).padStart(3),'BP',String(s('best-practices')).padStart(3),'SEO',String(s('seo')).padStart(3),
 '| FCP',m('first-contentful-paint'),'LCP',m('largest-contentful-paint'),'TBT',m('total-blocking-time'),'CLS',m('cumulative-layout-shift'));
"
