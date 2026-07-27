/* 從 3D 模型直接產生 1:1 雷切檔(A4,mm)
   黑線 = 切割 / 藍字 = 刻字(雷射軟體用顏色分圖層)
   用法:node export-cut.js      需要本機 HTTP 開著(python3 -m http.server 8099) */
const { chromium } = require('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'cut');

const SHEET = { w: 210, h: 297, m: 8, gap: 4 };   // A4 直放

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.waitForTimeout(2000);

  const parts = await p.evaluate(() => {
    updV2(gV2.userData.A, 0); gV2.updateMatrixWorld(true);
    const under = (o, r) => { while (o) { if (o === r) return true; o = o.parent; } return false; };
    const SKIP = { '頸脊': 1 };                       // 方棒,不是板材
    const seen = {};
    for (const S of SOLIDS) {
      if (!under(S.mesh, gV2) || SKIP[S.part]) continue;
      const key = S.part + '#' + JSON.stringify(S.poly.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]));
      if (!seen[key]) seen[key] = { part: S.part, poly: S.poly, holes: S.holes, t: S.t, n: 0 };
      seen[key].n++;
    }
    return Object.values(seen);
  });
  await b.close();

  // 展平:厚度 >3 的用 3mm 疊層 → 份數 ×(t/3)
  const items = [];
  for (const q of parts) {
    const layers = Math.max(1, Math.round(q.t / 3));
    const copies = q.n * layers;
    const xs = q.poly.map(v => v[0]), ys = q.poly.map(v => v[1]);
    const x0 = Math.min(...xs), y1 = Math.max(...ys);
    // SVG 的 y 向下、模型的 y 向上 → 這裡翻正,免得水滴凸輪/下顎/頭骨被鏡像
    const norm = a => a.map(v => [+(v[0] - x0).toFixed(2), +(y1 - v[1]).toFixed(2)]);
    for (let i = 0; i < copies; i++)
      items.push({ part: q.part, poly: norm(q.poly), holes: q.holes.map(norm),
                   w: Math.max(...xs) - x0, h: y1 - Math.min(...ys), layers, copies });
  }
  items.sort((a, b) => b.h - a.h || b.w - a.w);

  // 貨架式排版
  const sheets = [[]];
  let cx = SHEET.m, cy = SHEET.m, rowH = 0, si = 0;
  for (const it of items) {
    if (cx + it.w > SHEET.w - SHEET.m) { cx = SHEET.m; cy += rowH + SHEET.gap; rowH = 0; }
    if (cy + it.h > SHEET.h - SHEET.m) { sheets.push([]); si++; cx = SHEET.m; cy = SHEET.m; rowH = 0; }
    it.x = cx; it.y = cy; sheets[si].push(it);
    cx += it.w + SHEET.gap; rowH = Math.max(rowH, it.h);
  }

  const poly2d = (a, dx, dy) => a.map(v => `${(v[0] + dx).toFixed(2)},${(v[1] + dy).toFixed(2)}`).join(' ');
  const pages = sheets.map((s, i) => {
    const body = s.map(it => {
      const g = [`<polygon points="${poly2d(it.poly, it.x, it.y)}"/>`];
      it.holes.forEach(h => g.push(`<polygon points="${poly2d(h, it.x, it.y)}"/>`));
      const lab = it.part + (it.layers > 1 ? ` ×${it.layers}層` : '');
      const small = it.w < 26 || it.h < 12;
      g.push(`<text class="lb" style="font-size:${small ? 1.8 : 2.6}px" `+
             `x="${(it.x + it.w / 2).toFixed(1)}" y="${(it.y + (small ? it.h + 2.4 : it.h / 2)).toFixed(1)}">${lab}</text>`);
      return `<g>${g.join('')}</g>`;
    }).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm"
     viewBox="0 0 ${SHEET.w} ${SHEET.h}">
  <style>
    polygon{fill:none;stroke:#000;stroke-width:.1}
    .lb{fill:#06c;font:2.6px "Noto Sans TC",sans-serif;text-anchor:middle;dominant-baseline:middle}
    .hd{fill:#06c;font:3.4px sans-serif}
  </style>
  <g stroke="#000" stroke-width=".15" fill="none">
    <path d="M${SHEET.m},${SHEET.h - 12} h50 M${SHEET.m},${SHEET.h - 14} v4 M${SHEET.m + 25},${SHEET.h - 13} v3 M${SHEET.m + 50},${SHEET.h - 14} v4"/>
  </g>
  <text class="hd" style="font-size:2.4px" x="${SHEET.m + 53}" y="${SHEET.h - 11}">↑ 這段必須剛好 50mm,不對就是印表機縮放了</text>
  <text class="hd" x="${SHEET.m}" y="${SHEET.h - 3}">骷髏頭凸輪玩具 · 3mm 板 · 1:1 · 第 ${i + 1}/${sheets.length} 張 · 黑線=切割 藍字=刻字</text>
${body}
</svg>`;
  });

  pages.forEach((sv, i) => fs.writeFileSync(path.join(OUT, `cut-${i + 1}.svg`), sv));

  // ---- DXF(R12,雷射軟體最通吃的格式)----
  const dxfPoly = (pts, dx, dy) => {
    let o = '0\nPOLYLINE\n8\nCUT\n66\n1\n70\n1\n';
    for (const v of pts) o += `0\nVERTEX\n8\nCUT\n10\n${(v[0] + dx).toFixed(3)}\n20\n${(SHEET.h - (v[1] + dy)).toFixed(3)}\n`;
    return o + '0\nSEQEND\n8\nCUT\n';
  };
  sheets.forEach((s, i) => {
    let d = '0\nSECTION\n2\nENTITIES\n';
    for (const it of s) { d += dxfPoly(it.poly, it.x, it.y); it.holes.forEach(h => d += dxfPoly(h, it.x, it.y)); }
    d += '0\nENDSEC\n0\nEOF\n';
    fs.writeFileSync(path.join(OUT, `cut-${i + 1}.dxf`), d);
  });
  console.log(`零件種類 ${parts.length} 種,總片數 ${items.length} 片,排成 ${sheets.length} 張 A4`);
  sheets.forEach((s, i) => console.log(`  cut-${i + 1}.svg : ${s.length} 片`));
})();
