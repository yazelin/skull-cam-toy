/* 心跳凸輪的零件自檢:每片板 (1)孔完全落在輪廓內且離邊 ≥2mm (2)孔與孔 ≥2mm (3)輪廓不得自交。
   用法:node heart-partcheck.js      需要本機 HTTP 開著(python3 -m http.server 8099) */
const { chromium } = require('/home/ct/line-sticker-studio/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8099/heart.html');
  await p.waitForTimeout(2000);

  const out = await p.evaluate(() => {
    const MIN = 2.0;
    function inPoly(pt, poly) {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    }
    function dSeg(p, a, b) {
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const L2 = vx * vx + vy * vy || 1e-9;
      let t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
    }
    function dPolyPt(p, poly) {
      let d = 1e9;
      for (let i = 0; i < poly.length; i++) d = Math.min(d, dSeg(p, poly[i], poly[(i + 1) % poly.length]));
      return d;
    }
    // 線段相交(不含共端點)
    function segX(a, b, c, d) {
      const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
      const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    }
    const bad = [], info = [];
    for (const S of SOLIDS) {
      // (3) 輪廓自交
      const P = S.poly;
      for (let i = 0; i < P.length; i++) for (let j = i + 2; j < P.length; j++) {
        if (i === 0 && j === P.length - 1) continue;
        if (segX(P[i], P[(i + 1) % P.length], P[j], P[(j + 1) % P.length]))
          bad.push(S.part + ':輪廓自交 seg ' + i + '/' + j);
      }
      // (1)(2) 孔
      for (let h = 0; h < S.holes.length; h++) {
        const H = S.holes[h];
        let minEdge = 1e9, inside = true;
        for (const v of H) {
          if (!inPoly(v, P)) inside = false;
          minEdge = Math.min(minEdge, dPolyPt(v, P));
        }
        if (!inside) bad.push(S.part + ':孔 ' + h + ' 跑出輪廓外');
        else if (minEdge < MIN) bad.push(S.part + ':孔 ' + h + ' 離邊只有 ' + minEdge.toFixed(2) + 'mm');
        else info.push(S.part + ' 孔 ' + h + ' 離邊 ' + minEdge.toFixed(1) + 'mm');
        for (let g = h + 1; g < S.holes.length; g++) {
          let dd = 1e9;
          for (const v of H) dd = Math.min(dd, dPolyPt(v, S.holes[g]));
          if (dd < MIN) bad.push(S.part + ':孔 ' + h + '/' + g + ' 相距只有 ' + dd.toFixed(2) + 'mm');
          else info.push(S.part + ' 孔 ' + h + '/' + g + ' 相距 ' + dd.toFixed(1) + 'mm');
        }
      }
    }
    return { bad, info, n: SOLIDS.length };
  });
  await b.close();
  for (const l of out.info) console.log('  ok', l);
  if (out.bad.length) { console.log('不過!'); out.bad.forEach(l => console.log('  ✗', l)); process.exit(1); }
  console.log(`零件自檢全過:${out.n} 片(孔位/肉厚/輪廓自交)`);
})();
