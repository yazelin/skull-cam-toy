/* 心跳凸輪的干涉掃描:每片板佈 2mm 取樣點,曲柄 36 個角度,兩兩互測「A 的點有沒有落進 B 的實體」。
   當初就是這支抓到相位符號寫反(推桿半個週期陷進凸輪)。
   用法:node heart-collide.js      需要本機 HTTP 開著(python3 -m http.server 8099) */
const { chromium } = require('/home/ct/line-sticker-studio/node_modules/playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8099/heart.html');
  await p.waitForTimeout(2000);

  const out = await p.evaluate(() => {
    const V = new THREE.Vector3(), inv = new THREE.Matrix4();
    function inPoly(pt, poly) {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
      }
      return c;
    }
    function inSolid(S, pt) {
      if (pt.z < -0.01 || pt.z > S.t + 0.01) return false;
      if (!inPoly([pt.x, pt.y], S.poly)) return false;
      for (const h of S.holes) if (inPoly([pt.x, pt.y], h)) return false;
      return true;
    }
    function samples(S) {
      const xs = S.poly.map(v => v[0]), ys = S.poly.map(v => v[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const pts = [];
      for (let x = x0 + 0.5; x <= x1; x += 2) for (let y = y0 + 0.5; y <= y1; y += 2) {
        if (!inPoly([x, y], S.poly)) continue;
        let inH = false; for (const h of S.holes) if (inPoly([x, y], h)) { inH = true; break; }
        if (inH) continue;
        pts.push([x, y, S.t * 0.25], [x, y, S.t * 0.75]);
      }
      return pts;
    }
    const SAMP = SOLIDS.map(samples);
    const report = {};
    for (let ai = 0; ai < 36; ai++) {
      const A = ai / 36 * Math.PI * 2; updV2(null, A);
      scene.updateMatrixWorld(true);
      for (let i = 0; i < SOLIDS.length; i++) for (let j = 0; j < SOLIDS.length; j++) {
        if (i === j) continue;
        const Si = SOLIDS[i], Sj = SOLIDS[j];
        inv.copy(Sj.mesh.matrixWorld).invert();
        let n = 0;
        for (const q of SAMP[i]) {
          V.set(q[0], q[1], q[2]).applyMatrix4(Si.mesh.matrixWorld).applyMatrix4(inv);
          if (inSolid(Sj, V)) { n++; if (n > 2) break; }
        }
        if (n > 2) { const k = Si.part + ' ✕ ' + Sj.part; report[k] = (report[k] || 0) + 1; }
      }
    }
    updV2(null, 0);
    return { pairs: Object.keys(report).length, report, parts: SOLIDS.length };
  });
  await b.close();
  if (out.pairs) { console.log('干涉!', out.report); process.exit(1); }
  console.log(`零干涉:${out.parts} 片 × 36 角度全過`);
})();
