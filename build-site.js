/* 把 Markdown 轉成網站頁面。說明書只有一份來源(.md),頁面是產生出來的。
   用法:node build-site.js */
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const img = s => s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" style="max-width:100%;border-radius:8px;margin:.4em 0">');
const inline = s => img(esc(s))
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function md2html(src) {
  const L = src.split('\n');
  const out = [];
  let i = 0, inCode = false, listType = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) {
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else { closeList(); out.push('<pre><code>'); inCode = true; }
      i++; continue;
    }
    if (inCode) { out.push(esc(l)); i++; continue; }

    // 表格
    if (/^\|/.test(l) && /^\|[\s:|-]+\|$/.test(L[i + 1] || '')) {
      closeList();
      const cells = r => r.split('|').slice(1, -1).map(c => c.trim());
      out.push('<div class="tw"><table><thead><tr>' +
        cells(l).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
      i += 2;
      while (i < L.length && /^\|/.test(L[i])) {
        out.push('<tr>' + cells(L[i]).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>');
        i++;
      }
      out.push('</tbody></table></div>');
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const n = m[1].length;
      const id = m[2].replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${n} id="${id}">${inline(m[2])}</h${n}>`);
    } else if (/^---+$/.test(l)) { closeList(); out.push('<hr>'); }
    else if ((m = l.match(/^>\s?(.*)$/))) { closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
    else if ((m = l.match(/^\s*[-*]\s+(.*)$/))) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = l.match(/^\s*\d+\.\s+(.*)$/))) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (l.trim() === '') { closeList(); }
    else { closeList(); out.push(`<p>${inline(l)}</p>`); }
    i++;
  }
  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

const HEARTNAV = (cur) => `<nav class="nav"><a class="brand" href="heart.html">七夕限定 · 心跳凸輪</a>
  <a href="heart.html">3D 模擬</a>
  <a href="heart-print.html">3D 列印版</a>
  <a href="heart-assembly.html"${cur === 'heart' ? ' class="on"' : ''}>組裝說明</a>
  <a href="cut/heart-cut-1.svg">下載切割檔</a>
  <a href="./">骷髏頭本站</a></nav>`;

const NAV = (cur) => `<nav class="nav"><a class="brand" href="./">骷髏頭凸輪玩具</a>
  <a href="./"${cur === 'home' ? ' class="on"' : ''}>概覽</a>
  <a href="sim.html"${cur === 'sim' ? ' class="on"' : ''}>3D 模擬</a>
  <a href="assembly.html"${cur === 'asm' ? ' class="on"' : ''}>組裝說明</a>
  <a href="findings.html"${cur === 'fnd' ? ' class="on"' : ''}>驗證報告</a>
  <a href="#download">下載切割檔</a></nav>`;

const FOOT = fs.existsSync(path.join(DIR, '_footer.html'))
  ? fs.readFileSync(path.join(DIR, '_footer.html'), 'utf8') : '';

function page({ title, cur, body, desc, out }) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc || ''}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc || ''}">
<meta property="og:image" content="https://yazelin.github.io/skull-cam-toy/assets/og.jpg">
<meta property="og:url" content="https://yazelin.github.io/skull-cam-toy/${out || ''}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="site.css">
</head>
<body>
${cur === "heart" ? HEARTNAV(cur) : NAV(cur)}
<main class="doc">
${body}
</main>
${FOOT}
</body>
</html>`;
}

// ---- 產生頁面 ----
const jobs = [
  { src: 'ASSEMBLY.md', out: 'assembly.html', cur: 'asm', title: '組裝說明 · 骷髏頭凸輪玩具',
    desc: '3mm 板的十步組裝流程,每一步都附驗證方法。' },
  { src: 'FINDINGS.md', out: 'findings.html', cur: 'fnd', title: '驗證報告 · 骷髏頭凸輪玩具',
    desc: '原始圖面為什麼做不出來,以及修正版怎麼驗證的。' },
  { src: 'HEART-ASSEMBLY.md', out: 'heart-assembly.html', cur: 'heart', title: '組裝說明 · 七夕心跳凸輪',
    desc: '18 片 3mm 板的七步組裝流程,每一步都附驗收,含最容易裝錯的五件事。' },
];
for (const j of jobs) {
  const src = fs.readFileSync(path.join(DIR, j.src), 'utf8');
  fs.writeFileSync(path.join(DIR, j.out), page({ ...j, body: md2html(src) }));
  console.log('產生', j.out);
}
// 重新產生會蓋掉推廣 snippet,所以產生完立刻補回去
const { execFileSync } = require('child_process');
const APPLY = process.env.HOME + '/.claude/skills/promo-footer/apply.py';
if (fs.existsSync(APPLY)) {
  for (const j of jobs) {
    try { execFileSync('python3', [APPLY, path.join(DIR, j.out), 'skull-cam-toy'], { stdio: 'pipe' }); }
    catch (e) { console.log('推廣 snippet 套用失敗:', j.out); }
  }
  console.log('推廣 snippet 已補回');
}
console.log('（index.html 與 sim.html 是手寫的,不由這支產生）');
