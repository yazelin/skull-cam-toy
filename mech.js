/* 骷髏頭凸輪機構 —— 運動學核心
   單位 mm。座標:x=左右(0..180) y=前後(0=前板) z=上下(0=底板上表面)
   凸輪軸沿 x,軸心 (y=57, z=SHAFT_Z),平底從動件 → 升程 = max_i(px·sinθ + py·cosθ) */

// ---------- 凸輪 ----------
function liftPoly(poly, th) {           // 平底從動件:輪廓在「正上方」的最大投影
  const s = Math.sin(th), c = Math.cos(th);
  let m = -1e9;
  for (const p of poly) { const v = p[0] * s + p[1] * c; if (v > m) m = v; }
  return m;
}
function liftEcc(R, e, th) { return R + e * Math.cos(th); }   // 偏心圓
function rangeOf(f) {
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < 720; i++) { const v = f(i * Math.PI / 360); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return { min: lo, max: hi, lift: hi - lo };
}

// ================================================================
//  原始設計(直接照 PDF 圖面數字)
// ================================================================
const ORIG = {
  shaftZ: 30, shaftY: 57,
  box: { w: 180, d: 114, h: 90, t: 3 },
  // 頂板導槽 (頁7):x 中心 / y 50..66;轉頭槽 x120..136 y50..54
  slotX: { jaw: 57, nod: 82, eye: 107 }, turnSlot: { x0: 120, x1: 136, y0: 50, y1: 54 },
  neck: { x: 90, y: 90, dia: 8 },
  cams: {
    jaw: { x: 57, kind: 'poly', poly: PROFILES.cam1, phase: 0 },      // 水滴 14..26
    nod: { x: 82, kind: 'ecc', R: 22, e: 8, phase: 90 },             // 偏心圓 14..30
    eye: { x: 107, kind: 'poly', poly: PROFILES.cam4, phase: 180 },   // 雙凸 12..18
    turn: { x: 128, kind: 'pin', R: 20, pin: 12, phase: 270 }         // 偏心盤 Ø4 銷偏心 12
  },
  followers: { jaw: 78, nod: 86, eye: 70 },                            // 頁4 從動桿全長
  turntable: { R: 20, pin: 14, bore: 6 },                              // 頸柱轉盤:中心孔 Ø6、銷偏心 14
  link: { turn: 70, jaw: 55 }
};
ORIG.r = {
  jaw: th => liftPoly(ORIG.cams.jaw.poly, th),
  nod: th => liftEcc(ORIG.cams.nod.R, ORIG.cams.nod.e, th),
  eye: th => liftPoly(ORIG.cams.eye.poly, th)
};

// ================================================================
//  修正版 v2
// ================================================================
const V2 = {
  shaftZ: 36, shaftY: 57,
  box: { w: 180, d: 114, h: 90, t: 3 },      // 側板改 108 深(夾在前後板之間)
  cams: {
    eye: { x: 54, phase: 180 },
    jaw: { x: 70, phase: 0 },
    turn: { x: 124, phase: 270 },
    nod: { x: 110, phase: 90 }
  },
  rodX: { eye: 54, jaw: 70 },
  rodY: { lo: 45, hi: 84 },     // 推桿「腳」跨過凸輪
  shankY: { lo: 74, hi: 84 },   // 推桿「桿身」在頭部後方
  // 頸柱改成「脊板」:8 寬 × 6 厚,站在頭部後方 y=66..72,不穿過下顎/眼球所在的平面
  neck: { x: 90, y: 69, w: 8, d: 6 },
  guide: { z: 70 },
  posts: [[84, 52], [112, 68]],   // 升降板導柱(要完全落在板內)             // 中段導板
  lift: { x0: 78, x1: 118, y0: 45, y1: 78, t: 3 },   // 移出推桿的 x 範圍 → 完全不用開缺口
  turntable: { z0: 84, t: 3, armR: 30, hubR: 15, pinZ: 82.5 },  // 凸台穿頂板孔、上面加壓片 → 軸向被夾住
  // 轉頭板改「叉口(Scotch yoke)」:上下兩條平行邊夾住偏心圓 → 上下都是強制驅動,不靠重力
  turnPlate: { x: 124, y0: 50, y1: 94, slotC: 42.5, forkY: 88, forkH: 40.4 },
  head: { z0: 125, sx: 90 },    // 頭骨局部 (42,9) → 世界 (90,125)
  // 頭部由前而後:主片 51..54 / 下顎 54..60 / 主片 60..63 / 眼球桿 63..66 / 頸脊 66..72
  skullPlateY: [51, 60], skullT: 3, jawY: 54, jawT: 6, eyeBarY: 63, eyeBarT: 3,
  jawRodLen: 57, eyeRodLen: 117,
  jawZ0: 122,                   // 下顎「閉合」時的底面高度
  jawPin: { z: 156, x: [76, 104] },   // 下顎滑銷(固定在頭骨主片上)
  eyePin: { z: 176, x: [62, 118] },   // 要離眼窩(圓心±11)夠遠   // 眼球桿滑銷
  jawSlot: 24, eyeSlot: 18,
  socketR: 11, eyeballR: 3.5,
  pads: {                        // 推桿頂端頂到的受推板(在頭部座標系)
    jaw: { x0: 62, x1: 84, y0: 64, y1: 90 },
    eye: { x0: 42, x1: 70, y0: 66, y1: 92 }
  }
};
V2.r = {
  eye: th => liftPoly(PROFILES.cam4, th),          // 12..18   升程 6
  jaw: th => liftPoly(PROFILES.cam1, th),          // 14..26   升程 12
  turn: th => liftEcc(20, 8, th),                  // 12..28   升程 16
  nod: th => liftEcc(12, 4, th)                    //  8..16   升程 8
};
V2.rng = { eye: rangeOf(V2.r.eye), jaw: rangeOf(V2.r.jaw), turn: rangeOf(V2.r.turn), nod: rangeOf(V2.r.nod) };

const D2R = Math.PI / 180;
function ph(cam, th) { return th + cam.phase * D2R; }

/* 修正版:給定曲柄角 → 全機狀態 */
function stateV2(th) {
  const rEye = V2.r.eye(ph(V2.cams.eye, th));
  const rJaw = V2.r.jaw(ph(V2.cams.jaw, th));
  const rTurn = V2.r.turn(ph(V2.cams.turn, th));
  const rNod = V2.r.nod(ph(V2.cams.nod, th));

  const liftZ = V2.shaftZ + rNod;                 // 升降板底面
  const nod = rNod - V2.rng.nod.min;               // 頭部上下位移 0..8
  const headZ = V2.head.z0 + nod;

  const turnPlateZ = V2.shaftZ + rTurn;            // 轉頭推板底面
  // 斜槽:銷的絕對 z 固定 = 轉盤中面;銷 y = (pinZ - plateZ) + slotC
  const pinZ = V2.turntable.pinZ;
  const pinY = (pinZ - turnPlateZ) + V2.turnPlate.slotC;
  const sinT = (pinY - V2.neck.y) / V2.turntable.armR;
  const turnAng = Math.asin(Math.max(-1, Math.min(1, sinT)));

  const jawRodTop = V2.shaftZ + rJaw + V2.jawRodLen;   //  96..108
  const eyeRodTop = V2.shaftZ + rEye + V2.eyeRodLen;   // 170..176

  return { th, rEye, rJaw, rTurn, rNod, liftZ, nod, headZ, turnPlateZ, pinY, turnAng, jawRodTop, eyeRodTop };
}

/* 原始設計:同樣算一遍,好把「破在哪」量出來 */
function stateOrig(th) {
  const rJaw = ORIG.r.jaw(ph(ORIG.cams.jaw, th));
  const rNod = ORIG.r.nod(ph(ORIG.cams.nod, th));
  const rEye = ORIG.r.eye(ph(ORIG.cams.eye, th));
  const a = ph(ORIG.cams.turn, th);
  // 偏心盤上的 Ø4 銷:繞軸心在 y-z 平面畫圓
  const pin = { x: ORIG.cams.turn.x, y: ORIG.shaftY + ORIG.cams.turn.pin * Math.cos(a), z: ORIG.shaftZ + ORIG.cams.turn.pin * Math.sin(a) };
  return {
    th, rJaw, rNod, rEye, pin,
    jawTop: ORIG.shaftZ + rJaw + ORIG.followers.jaw,
    nodTop: ORIG.shaftZ + rNod + ORIG.followers.nod,
    eyeTop: ORIG.shaftZ + rEye + ORIG.followers.eye
  };
}

// ================================================================
//  檢查
// ================================================================
function fmt(v, n) { return (Math.round(v * (n === undefined ? 10 : Math.pow(10, n))) / (n === undefined ? 10 : Math.pow(10, n))).toFixed(n === undefined ? 1 : n); }

function checksOrig() {
  const out = [];
  // 1. 凸輪 vs 底板
  const rmax = { jaw: rangeOf(ORIG.r.jaw).max, nod: rangeOf(ORIG.r.nod).max, eye: rangeOf(ORIG.r.eye).max, turn: ORIG.cams.turn.R };
  const gapNod = ORIG.shaftZ - rmax.nod;
  out.push({ ok: gapNod > 1, t: '②點頭凸輪 vs 底板', v: `最大半徑 ${fmt(rmax.nod)} / 軸心高 ${ORIG.shaftZ} → 間隙 ${fmt(gapNod)} mm`, why: '偏心 8 的 R22 圓盤掃出半徑 30,軸心只有 30 高,轉半圈就刮到底板。' });
  out.push({ ok: ORIG.shaftZ - rmax.jaw > 1, t: '①下顎凸輪 vs 底板', v: `最大半徑 ${fmt(rmax.jaw)} → 間隙 ${fmt(ORIG.shaftZ - rmax.jaw)} mm`, why: '勉強過關,但只剩 4mm。' });

  // 2. 從動桿 B(點頭)長度
  let nodLo = 1e9, nodHi = -1e9;
  for (let i = 0; i < 360; i++) { const s = stateOrig(i * D2R); nodLo = Math.min(nodLo, s.nodTop); nodHi = Math.max(nodHi, s.nodTop); }
  const topPlate = ORIG.box.h + ORIG.box.t;
  out.push({ ok: nodHi < topPlate, t: '點頭升降板落點', v: `頂端 z=${fmt(nodLo)}~${fmt(nodHi)},頂板面 z=${topPlate}`, why: `86mm 的從動桿 B 把升降板推到頂板「上方 ${fmt(nodLo - topPlate)}~${fmt(nodHi - topPlate)}mm」,那正是頭部要待的位置。組裝說明寫「頸柱穿頂板接升降板」,但升降板根本在頂板外面。板長應該約 24mm。` });

  // 3. 轉頭連桿:兩端旋轉軸互相垂直 → 空間過約束
  let need = [];
  for (let i = 0; i < 360; i++) {
    const s = stateOrig(i * D2R);
    // 轉盤銷:繞垂直頸柱軸 (90,90) 在水平面上跑,半徑 14
    let best = 1e9;
    for (let j = 0; j < 360; j += 2) {
      const b = j * D2R;
      const q = { x: ORIG.neck.x + ORIG.turntable.pin * Math.cos(b), y: ORIG.neck.y + ORIG.turntable.pin * Math.sin(b), z: topPlate + 3 };
      best = Math.min(best, Math.hypot(q.x - s.pin.x, q.y - s.pin.y, q.z - s.pin.z));
    }
    need.push(best);
  }
  const nMin = Math.min(...need), nMax = Math.max(...need);
  out.push({ ok: nMax - nMin < 0.5, t: '轉頭連桿長度', v: `即使讓轉盤自由轉,連桿長度仍需在 ${fmt(nMin)}~${fmt(nMax)} mm 之間變動(差 ${fmt(nMax - nMin)} mm)`, why: '偏心銷在「垂直面」畫圓,轉盤銷在「水平面」畫圓,兩端都是普通旋轉銷、軸線互相垂直 → 這是超靜定的空間連桿(RSSR 少了球接頭),剛性連桿長度無解。圖上標的 70mm 只在少數幾個角度成立,其餘角度會卡死或把銷掰彎。' });

  // 4. 轉頭連桿槽方向
  const pinYsw = 2 * ORIG.cams.turn.pin;
  const slotY = ORIG.turnSlot.y1 - ORIG.turnSlot.y0;
  out.push({ ok: slotY >= pinYsw + 4, t: '頂板轉頭連桿槽', v: `槽 ${ORIG.turnSlot.x1 - ORIG.turnSlot.x0}(沿x) × ${slotY}(沿y);連桿實際要沿 y 走 ±${ORIG.cams.turn.pin} = ${pinYsw}mm`, why: '槽開錯 90°:偏心銷的位移在前後方向(y),槽卻是左右方向(x)且只有 4mm 寬。連桿一進槽就頂死。' });

  // 5. 頸柱孔徑
  out.push({ ok: false, t: '頸柱直徑', v: `頂板 Ø8 / 頸柱轉盤 Ø6 / 點頭升降板:沒有頸柱孔(只有 3 個 Ø4)`, why: '同一根頸柱在三個零件上是三種尺寸,其中一個根本沒開孔。' });

  // 6. 連桿孔畫在零件外
  out.push({ ok: false, t: '下顎連桿 / 轉頭連桿 的第二個孔', v: '下顎連桿外形 55×10,孔在 (6,5) 與 (6,50);轉頭連桿 70×10,孔在 (6,5) 與 (6,65)', why: 'x/y 寫反了。第二個孔畫在零件輪廓外 40mm / 55mm 的空白處,照描下來會得到「只有一個孔」的連桿。應為 (49,5) 與 (64,5)。' });

  // 7. 手把孔
  out.push({ ok: false, t: '手把孔位置', v: '前板 Ø8 在 (150, 25);凸輪軸是側板 Ø6 在 (57, 30)', why: '凸輪軸沿左右方向穿兩片側板,不會穿過前板。前板那個 Ø8 手把孔既不同面也不同高,裝不上曲柄。' });

  // 8. 推桿在臉前面
  out.push({ ok: false, t: '推桿與頭部的前後位置', v: `三個從動桿導槽在 y=58,頸柱孔在 y=90`, why: '頭裝在 y=90,推桿卻從 y=58 冒出來 —— 距離臉部前方 32mm,三根桿子直接豎在臉前面,而且構不到頭裡的下顎與眼球。' });

  // 9. 下顎單銷
  out.push({ ok: false, t: '下顎開合方式', v: '頭骨是正面平板,下顎只有一個中心 Ø4 銷 (42,17)', why: '正面平板 + 單一垂直於板面的銷 → 下顎只會在板平面內「左右擺」,做不出開合。要嘛改成兩側滑槽垂直下滑,要嘛整顆頭改側面剪影。' });

  // 10. 側板深度
  out.push({ ok: false, t: '盒體接合', v: '前後板 180×90(滿寬)+ 側板 114×90(滿深)', why: '兩者都取「滿尺寸」,夾不起來。側板應為 108(=114−3−3)。' });

  // 11. 標註 vs 實形
  out.push({ ok: false, t: '頭骨標註尺寸', v: '標 84×100,實際輪廓 69.3×91', why: '尺寸線是照 84/100 畫的,但輪廓沒跟著改。1:1 描圖時以輪廓為準,標註會誤導。' });
  return out;
}

function checksV2() {
  const out = [];
  const S = []; for (let i = 0; i < 360; i++) S.push(stateV2(i * D2R));
  const mm = (f) => { let lo = 1e9, hi = -1e9; for (const s of S) { const v = f(s); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };

  // 凸輪對地
  for (const [k, name] of [['eye', '眼球'], ['jaw', '下顎'], ['turn', '轉頭'], ['nod', '點頭']]) {
    const g = V2.shaftZ - V2.rng[k].max;
    out.push({ ok: g >= 5, t: `${name}凸輪對底板間隙`, v: `${fmt(g)} mm(最大半徑 ${fmt(V2.rng[k].max)},軸心 ${V2.shaftZ})` });
  }
  // 行程
  out.push({ ok: true, t: '下顎行程', v: `${fmt(V2.rng.jaw.lift)} mm(推桿頂端 ${fmt(mm(s => s.jawRodTop)[0])}~${fmt(mm(s => s.jawRodTop)[1])})` });
  out.push({ ok: true, t: '點頭行程', v: `${fmt(V2.rng.nod.lift)} mm(整顆頭上下)` });
  out.push({ ok: true, t: '眼球行程', v: `${fmt(V2.rng.eye.lift)} mm(每轉兩次,雙凸輪)` });
  const [tl, th2] = mm(s => s.turnAng / D2R);
  out.push({ ok: Math.abs(th2 - tl) > 10, t: '轉頭角度', v: `${fmt(tl)}° ~ ${fmt(th2)}°(共 ${fmt(th2 - tl)}°)` });

  // 斜槽銷不脫槽
  const [py0, py1] = mm(s => s.pinY);
  out.push({ ok: py0 >= V2.turnPlate.y0 + 2 && py1 <= V2.turnPlate.y1 - 2, t: '轉頭斜槽:銷不脫槽', v: `銷 y=${fmt(py0)}~${fmt(py1)},槽板範圍 y=${V2.turnPlate.y0}~${V2.turnPlate.y1}` });

  // 頭部最低點 vs 頂板(下顎受推板貼在下顎底面下方 3mm)
  const jz0 = mm(s => s.jawRodTop)[0] - 3;
  out.push({ ok: jz0 > V2.box.h + V2.box.t, t: '頭部最低點 vs 頂板', v: `最低 z=${fmt(jz0)},頂板面 z=${V2.box.h + V2.box.t} → 間隙 ${fmt(jz0 - (V2.box.h + V2.box.t))} mm` });

  // 相對行程 vs 導槽
  const relJaw = mm(s => s.jawRodTop - s.nod);
  out.push({ ok: (relJaw[1] - relJaw[0]) < V2.jawSlot, t: '下顎導槽長度', v: `相對頭部行程 ${fmt(relJaw[1] - relJaw[0])} mm(點頭 ${fmt(V2.rng.nod.lift)} + 凸輪 ${fmt(V2.rng.jaw.lift)}),槽長 ${V2.jawSlot} mm` });
  const relEye = mm(s => s.eyeRodTop - s.nod);
  const play = 2 * (V2.socketR - V2.eyeballR);
  out.push({ ok: (relEye[1] - relEye[0]) < play, t: '眼球不跑出眼窩', v: `相對行程 ${fmt(relEye[1] - relEye[0])} mm,眼窩可容 ${fmt(play)} mm(Ø${2 * V2.socketR} 窩 / Ø${2 * V2.eyeballR} 珠)` });

  // 升降板不撞轉盤臂
  out.push({ ok: mm(s => s.liftZ)[1] + V2.lift.t < V2.turntable.z0, t: '升降板 vs 轉盤臂', v: `升降板頂面最高 ${fmt(mm(s => s.liftZ)[1] + V2.lift.t)},轉盤在 z=${V2.turntable.z0}` });

  // 推桿接觸點在受推面內(頭部會轉,接觸點在頭座標系裡會跑)
  for (const [k, rx, name, pad] of [['jaw', V2.rodX.jaw, '下顎受推板', V2.pads.jaw],
  ['eye', V2.rodX.eye, '眼球受推板', V2.pads.eye]]) {
    let worst = null, bad = false;
    for (const s of S) {
      const dx = rx - V2.neck.x, dy = 79 - V2.neck.y, a = -s.turnAng;
      const hx = V2.neck.x + dx * Math.cos(a) - dy * Math.sin(a);
      const hy = V2.neck.y + dx * Math.sin(a) + dy * Math.cos(a);
      if (hx < pad.x0 || hx > pad.x1 || hy < pad.y0 || hy > pad.y1) bad = true;
      if (!worst) worst = [hx, hx, hy, hy];
      worst = [Math.min(worst[0], hx), Math.max(worst[1], hx), Math.min(worst[2], hy), Math.max(worst[3], hy)];
    }
    out.push({ ok: !bad, t: `${name}尺寸夠不夠`, v: `頭轉動時接觸點在頭部座標系跑到 x=${fmt(worst[0])}~${fmt(worst[1])}, y=${fmt(worst[2])}~${fmt(worst[3])};受推板 x=${pad.x0}~${pad.x1}, y=${pad.y0}~${pad.y1}` });
  }
  return out;
}

// ================================================================
//  約束盤點:每個動件的 6 個自由度分別被什麼固定住
//  form = 形封閉(靠形狀,拿不掉);force = 力封閉(靠重力/彈力,快搖或翻倒會脫開)
// ================================================================
const DOF = [
  { p: '凸輪軸組(軸+4凸輪+曲柄)', rows: [
    ['繞 x 轉', 'drive', '手搖輸入'],
    ['沿 x', 'form', '兩顆 Ø14 軸環抵住側板內側'],
    ['沿 y / 沿 z', 'form', '兩片側板的 Ø6 軸孔'],
    ['繞 y / 繞 z', 'form', '同上兩軸承,基距 174mm'] ] },
  { p: '眼球推桿', rows: [
    ['沿 z（上）', 'form', '雙凸凸輪頂上來'],
    ['沿 z（下）', 'force', '只有眼球橫桿自重 —— 最弱的一環,建議加回位橡皮筋'],
    ['沿 x', 'form', '頂板槽 + 中段導板槽(z=70 與 90,基距 20mm)'],
    ['沿 y', 'form', '兩處槽的前後端(槽長 14,桿身寬 10)'],
    ['三個轉動', 'form', '上述兩處槽'] ] },
  { p: '下顎推桿', rows: [
    ['沿 z（上）', 'form', '水滴凸輪頂上來'],
    ['沿 z（下）', 'force', '下顎自重(比眼球重,但快搖仍建議加橡皮筋)'],
    ['沿 x / y / 轉動', 'form', '同眼球推桿'],
    ['腳的寬度', 'note', '腳必須 y=45~84:水滴凸輪的平底接觸點會偏到 +11.8mm,腳太窄會踩空'] ] },
  { p: '轉頭叉口板', rows: [
    ['沿 z（上下都是）', 'form', '叉口上下兩條平行邊夾住 Ø40 偏心圓,間隙 0.20mm —— 強制驅動,不靠重力'],
    ['沿 x', 'form', '頂板槽 + 兩片導片形成的通道(z=66~79 與 90~93)'],
    ['沿 y', 'form', '頂板槽兩端;叉底離凸輪還有 3.0mm'],
    ['轉動', 'form', '同上'] ] },
  { p: '點頭升降板', rows: [
    ['沿 z（上）', 'form', '偏心凸輪頂上來'],
    ['沿 z（下）', 'force', '整顆頭的重量壓著 —— 負載夠大,力封閉沒問題'],
    ['沿 x / y / 繞 z', 'form', '兩支 Ø4 導柱(下插底板、上插中段導板)'],
    ['板面完整性', 'note', '板移到 x=78~118,完全避開推桿 → 不用開缺口,不會被切斷'] ] },
  { p: '頸脊(方棒)', rows: [
    ['沿 z', 'force', '坐在升降板上,頭的自重壓著'],
    ['繞 z', 'form', '轉盤的方孔帶動(花鍵)'],
    ['沿 x / y / 傾倒', 'form', '轉盤凸台 12mm 高的方孔導引(不是只有 3mm)'] ] },
  { p: '轉盤組', rows: [
    ['沿 z', 'form', '下盤在頂板下、壓片在頂板上 → 被頂板夾住'],
    ['沿 x / y', 'form', 'Ø20 凸台坐在頂板 Ø20.6 孔裡'],
    ['繞 z', 'drive', '撥銷 + 斜槽驅動'] ] },
  { p: '下顎', rows: [
    ['沿 z（上）', 'form', '推桿頂在受推板底面(受推板從下顎背面 y=60 接出去)'],
    ['沿 z（下）', 'force', '自重;行程由升支滑槽兩端限位,掉不出來'],
    ['沿 x / 轉動', 'form', '兩支 Ø4 滑銷 + 升支滑槽'],
    ['沿 y', 'form', '夾在兩片頭骨主片之間'] ] },
  { p: '眼球橫桿', rows: [
    ['沿 z', 'form/force', '推桿頂上、自重落下,兩端由滑槽限位'],
    ['其餘', 'form', '兩支 Ø4 滑銷 + 夾在頭骨後片與頸脊之間'] ] },
  { p: '頭骨(主片×2)', rows: [
    ['全部', 'form', '用接合塊黏在頸脊上,與頸脊同動'] ] }
];
