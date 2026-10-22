const fs = require('fs');
const base = 'C:/Users/Rasheed/.cline/data/workspaces/chat/seeds-academics-hub/';
const src = fs.readFileSync(base + 'app.js', 'utf8');
const html = fs.readFileSync(base + 'index.html', 'utf8');
const set = new Set();
function add(s) {
  if (typeof s !== 'string') return;
  const t = s.trim();
  if (t.length < 3) return;
  if (!/[A-Za-z\u00C0-\uFFFF]{2,}/.test(t)) return;
  set.add(t);
}
for (const m of src.matchAll(/pageHeading\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/g)) { add(m[1]); add(m[2]); add(m[3]); }
for (const m of src.matchAll(/metric\('((?:[^'\\]|\\.)*)'/g)) add(m[1]);
for (const m of src.matchAll(/field\('(?:[^'\\]|\\.)*',\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1]);
for (const m of src.matchAll(/imageField\('(?:[^'\\]|\\.)*',\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1]);
for (const m of src.matchAll(/action\('(?:[^'\\]|\\.)*',\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1]);
for (const m of src.matchAll(/optionList\([^)]*?,\s*'((?:[^'\\]|\\.)*)'\)/g)) add(m[1]);
for (const m of src.matchAll(/directoryView\('(?:[^'\\]|\\.)*',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\)/g)) { add(m[1]); add(m[2]); add(m[3]); }
const labelsBlock = src.match(/const labels = \{([\s\S]*?)\};/);
if (labelsBlock) for (const m of labelsBlock[1].matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1]);
const roleBlock = src.match(/const roleNames = \{([\s\S]*?)\};/);
if (roleBlock) for (const m of roleBlock[1].matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)) add(m[1]);
for (const m of src.matchAll(/<th>([^<${]{1,60})<\/th>/g)) add(m[1].trim());
for (const m of src.matchAll(/<h2>([^<${]{1,80})<\/h2>/g)) add(m[1].trim());
for (const m of src.matchAll(/<h3>([^<${]{1,80})<\/h3>/g)) add(m[1].trim());
for (const m of src.matchAll(/>([^<>$]{2,50})<\/button>/g)) add(m[1].trim());
for (const m of src.matchAll(/<strong>([^<${]{2,60})<\/strong>/g)) add(m[1].trim());
for (const m of html.matchAll(/>([^<>$]{2,60})</g)) add(m[1].trim());
const arr = [...set].sort();
const obj = {};
for (const s of arr) obj[s] = s;
const out = 'window.SEEDS_LABEL_DEFAULTS = ' + JSON.stringify(obj, null, 2) + ';\n';
fs.writeFileSync(base + 'label-defaults.js', out, 'utf8');
console.log('count:', arr.length);
