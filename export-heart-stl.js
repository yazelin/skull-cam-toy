/* 心跳凸輪 3D 列印版:從 heart.html 的同一份幾何直接產生 STL(mm)
   疊層件印全厚(凸輪 9、推桿/曲柄 6),其餘 3mm 平板;全部平躺列印、免支撐。
   用法:python3 -m http.server 8099 開著,然後 node export-heart-stl.js */
const { chromium } = require('/home/ct/line-sticker-studio/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'print', 'flat');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8099/heart.html');
  await p.waitForTimeout(2000);

  const files = await p.evaluate(() => {
    // 同一片板可能進場多份(側板×2、軸環×2):去重後記份數
    const seen = {};
    for (const S of SOLIDS) {
      const key = S.part + '#' + JSON.stringify(S.poly.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]));
      if (!seen[key]) seen[key] = { part: S.part, poly: S.poly, holes: S.holes, t: S.t, n: 0 };
      seen[key].n++;
    }
    // 疊層合併:同名同輪廓在木板版是 t/3 片,列印版一件全厚 —— SOLIDS 的 t 已是全厚,直接用
    const out = [];
    for (const q of Object.values(seen)) {
      // three.js 的 Shape 三角化(頁面裡已載 three.min.js)
      const shape = new THREE.Shape(q.poly.map(v => new THREE.Vector2(v[0], v[1])));
      for (const h of q.holes) shape.holes.push(new THREE.Path(h.map(v => new THREE.Vector2(v[0], v[1]))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: q.t, bevelEnabled: false });
      const pos = geo.attributes.position, idx = geo.index;
      const tri = [];
      const v = i => [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const N = idx ? idx.count : pos.count;
      for (let i = 0; i < N; i += 3) {
        const a = v(idx ? idx.getX(i) : i), b2 = v(idx ? idx.getX(i + 1) : i + 1), c = v(idx ? idx.getX(i + 2) : i + 2);
        tri.push([a, b2, c]);
      }
      out.push({ part: q.part, n: q.n, t: q.t, tri });
    }
    return out;
  });
  await b.close();

  fs.mkdirSync(OUT, { recursive: true });
  const slug = {
    '底板': 'base', '側板': 'side', '前後裙板': 'skirt', '導片': 'guide-side', '導片前後': 'guide-frontback',
    '頂板': 'top',
    '偏心凸輪': 'cam', '推桿': 'follower', '心': 'heart', '曲柄臂': 'crank', '軸環': 'collar',
  };
  const norm = ([x, y, z]) => [x, y, z];
  const stl = (name, tris) => {
    const L = ['solid ' + name];
    for (const [a, b2, c] of tris) {
      const u = [b2[0] - a[0], b2[1] - a[1], b2[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const len = Math.hypot(...n) || 1; n = n.map(q => q / len);
      L.push(` facet normal ${n.join(' ')}`, '  outer loop');
      for (const q of [a, b2, c]) L.push(`   vertex ${norm(q).join(' ')}`);
      L.push('  endloop', ' endfacet');
    }
    L.push('endsolid ' + name);
    return L.join('\n');
  };

  let i = 0; const manifest = [];
  for (const f of files) {
    i++;
    const s = slug[f.part] || ('part' + i);
    const name = `heart-${String(i).padStart(2, '0')}-${s}`;
    fs.writeFileSync(path.join(OUT, name + '.stl'), stl(name, f.tri));
    manifest.push(`${name}.stl  ${f.part}  厚 ${f.t}mm  印 ${f.n} 件`);
    console.log(manifest[manifest.length - 1]);
  }
  fs.writeFileSync(path.join(OUT, 'MANIFEST.txt'), manifest.join('\n') + '\n');
  console.log(`\n共 ${files.length} 種零件 → ${files.reduce((a, f) => a + f.n, 0)} 件`);
})();
