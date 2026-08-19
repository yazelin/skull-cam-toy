/* 心跳凸輪「3D 列印原生版」STL 匯出:從 heart-print.html 的同一份幾何產生。
   多片一體的零件(箱身 5 片、頂蓋 9 片)以世界座標合併成一檔(多殼,切片軟體自動聯集);
   單片零件用局部座標平躺輸出;軸與手把銷是旋轉體,腳本內直接生成。
   用法:python3 -m http.server 8099 開著,然後 node export-heart-print-stl.js */
const { chromium } = require('/home/ct/line-sticker-studio/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'print');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://127.0.0.1:8099/heart-print.html');
  await p.waitForTimeout(2000);

  const data = await p.evaluate(() => {
    updV2(null, 0); applyExplode(0); scene.updateMatrixWorld(true);
    const V = new THREE.Vector3();
    // 各 mesh 的三角形取世界座標,換到機構座標 (x, y, z) = (three.x, three.z, three.y)
    function meshTris(m) {
      const g = m.geometry, pos = g.attributes.position, idx = g.index, tri = [];
      const v = i => { V.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld); return [V.x, V.z, V.y]; };
      const N = idx ? idx.count : pos.count;
      for (let i = 0; i < N; i += 3)
        tri.push([v(idx ? idx.getX(i) : i), v(idx ? idx.getX(i + 1) : i + 1), v(idx ? idx.getX(i + 2) : i + 2)]);
      return tri;
    }
    // three→機構 座標換手性:x→x, y→z, z→y 是鏡射(行列式 -1),翻轉三角形繞向補正
    function fixWinding(tris) { return tris.map(([a, b, c]) => [a, c, b]); }
    const byPart = {};
    for (const S of SOLIDS) { (byPart[S.part] = byPart[S.part] || []).push(S.mesh); }
    // 世界座標零件:箱身、頂蓋(多片一體)
    const world = {};
    for (const part of ['箱身', '頂蓋']) {
      world[part] = fixWinding(byPart[part].flatMap(meshTris));
    }
    // 局部平躺零件:單片,poly+t 直接回傳(節點端擠出)
    const seen = {};
    for (const S of SOLIDS) {
      if (S.part === '箱身' || S.part === '頂蓋') continue;
      const key = S.part;
      if (!seen[key]) seen[key] = { part: S.part, poly: S.poly, holes: S.holes, t: S.t, n: 0 };
      seen[key].n++;
    }
    // 頂蓋要翻面印(導套朝上):繞 x 軸轉 180°,再平移回正
    const capH = 78, capY = 70;
    world['頂蓋'] = world['頂蓋'].map(t => t.map(([x, y, z]) => [x, capY - y, capH - z]));
    // 繞 x 轉 π 是剛體旋轉((y,z)→(-y,-z) 再平移),繞向不變 —— 但上面寫的是 (y,z)→(capY-y, capH-z) 同構,繞向不變
    return { world, flat: Object.values(seen), D: { shaftR: D.shaftR, shaftDflat: D.shaftDflat } };
  });
  await b.close();

  // ---- 節點端幾何工具:多邊形(含孔)擠出成三角形 ----
  // 用 three 同款 earcut?這裡零件都是簡單多邊形,走扇形+側壁:凸的扇形會錯,改耳切(簡化版,無孔件用)
  // 有孔的單片件(凸輪 D 孔、間隔套、曲柄)孔多 → 直接在頁面端已可拿 mesh;為省事,單片件也走頁面幾何。
  // ↑ ponytail:先驗證發現單片件其實也能從頁面拿,但局部平躺要重建變換;改用「純數學擠出」只處理這裡實際存在的形狀:
  //   所有單片件的 poly/holes 都是簡單多邊形,用 earcut 最穩 —— 自帶一份極簡 earcut(凸孔夠用)。
  // 實務:間隔套/凸輪/曲柄孔皆凸多邊形,採「橋接孔到外圈再耳切」太複雜;
  //   改走「頁面端擠出」:重開頁面拿單片件的 ExtrudeGeometry(局部座標,天然平躺)。
  const b2 = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p2 = await b2.newPage({ viewport: { width: 900, height: 600 } });
  await p2.goto('http://127.0.0.1:8099/heart-print.html');
  await p2.waitForTimeout(2000);
  const flatTris = await p2.evaluate((flat) => {
    const out = {};
    for (const q of flat) {
      const shape = new THREE.Shape(q.poly.map(v => new THREE.Vector2(v[0], v[1])));
      for (const h of q.holes) shape.holes.push(new THREE.Path(h.map(v => new THREE.Vector2(v[0], v[1]))));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: q.t, bevelEnabled: false });
      const pos = geo.attributes.position, idx = geo.index, tri = [];
      const v = i => [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const N = idx ? idx.count : pos.count;
      for (let i = 0; i < N; i += 3) tri.push([v(idx ? idx.getX(i) : i), v(idx ? idx.getX(i + 1) : i + 1), v(idx ? idx.getX(i + 2) : i + 2)]);
      out[q.part] = { tri, n: q.n, t: q.t };
    }
    // 軸:D 形截面擠 92(平躺印,D 面朝下;切片軟體內自行翻轉)
    const r = 3, f = 2.0, a = Math.asin(f / r), pts = [];
    for (let i = 0; i <= 36; i++) { const t = (Math.PI - a) + i / 36 * (2 * Math.PI - (Math.PI - 2 * a)); pts.push([r * Math.cos(t), r * Math.sin(t)]); }
    {
      const shape = new THREE.Shape(pts.map(v => new THREE.Vector2(v[0], v[1])));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 92, bevelEnabled: false });
      const pos = geo.attributes.position, idx = geo.index, tri = [];
      const v = i => [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const N = idx ? idx.count : pos.count;
      for (let i = 0; i < N; i += 3) tri.push([v(idx ? idx.getX(i) : i), v(idx ? idx.getX(i + 1) : i + 1), v(idx ? idx.getX(i + 2) : i + 2)]);
      out['軸'] = { tri, n: 1, t: 92 };
    }
    // 手把銷:Ø6×30 桿 + Ø10×3 帽,兩殼一檔(站著印)
    {
      const tri = [];
      function cyl(r, h, z0) {
        const n = 28, ring = i => [r * Math.cos(i / n * 2 * Math.PI), r * Math.sin(i / n * 2 * Math.PI)];
        for (let i = 0; i < n; i++) {
          const [x0, y0] = ring(i), [x1, y1] = ring(i + 1);
          tri.push([[x0, y0, z0], [x1, y1, z0], [x1, y1, z0 + h]], [[x0, y0, z0], [x1, y1, z0 + h], [x0, y0, z0 + h]]);
          tri.push([[0, 0, z0], [x1, y1, z0], [x0, y0, z0]]);            // 底蓋
          tri.push([[0, 0, z0 + h], [x0, y0, z0 + h], [x1, y1, z0 + h]]); // 頂蓋
        }
      }
      cyl(5, 3, 0);      // 帽在下(平躺大面)
      cyl(3, 30, 3);     // 桿
      out['手把銷'] = { tri, n: 1, t: 33 };
    }
    return out;
  }, data.flat);
  await b2.close();

  fs.mkdirSync(OUT, { recursive: true });
  const stl = (name, tris) => {
    const L = ['solid ' + name];
    for (const [a, b3, c] of tris) {
      const u = [b3[0] - a[0], b3[1] - a[1], b3[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const len = Math.hypot(...n) || 1; n = n.map(q => q / len);
      L.push(` facet normal ${n.join(' ')}`, '  outer loop');
      for (const q of [a, b3, c]) L.push(`   vertex ${q.map(x => +x.toFixed(4)).join(' ')}`);
      L.push('  endloop', ' endfacet');
    }
    L.push('endsolid ' + name);
    return L.join('\n');
  };
  const slug = {
    '箱身': 'body', '頂蓋': 'cap', '偏心凸輪': 'cam', '間隔套': 'spacer',
    '推桿': 'follower', '心': 'heart', '曲柄臂': 'crank', '軸': 'shaft', '手把銷': 'handle-pin',
  };
  const manifest = []; let i = 0;
  const emit = (part, tris, n, note) => {
    i++;
    const name = `hp-${String(i).padStart(2, '0')}-${slug[part] || 'part'}`;
    fs.writeFileSync(path.join(OUT, name + '.stl'), stl(name, tris));
    manifest.push(`${name}.stl  ${part}  印 ${n} 件${note ? '  ' + note : ''}`);
    console.log(manifest[manifest.length - 1]);
  };
  emit('箱身', data.world['箱身'], 1, '(開口朝上直接印)');
  emit('頂蓋', data.world['頂蓋'], 1, '(已翻好:導套朝上印,裝配時翻回)');
  for (const part of ['偏心凸輪', '間隔套', '推桿', '心', '曲柄臂', '軸', '手把銷'])
    emit(part, flatTris[part].tri, flatTris[part].n, part === '軸' ? '(平躺印,D 面朝下)' : part === '間隔套' ? '(站著印)' : '');
  fs.writeFileSync(path.join(OUT, 'MANIFEST.txt'), manifest.join('\n') + '\n');
  console.log(`\n共 ${manifest.length} 種零件`);
})();
