const { chromium } = require('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:900,height:600}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('http://127.0.0.1:8099/sim.html'); await p.waitForTimeout(2000);
 const rows=await p.evaluate(()=>{
  updV2(gV2.userData.A,0); gV2.updateMatrixWorld(true);
  const under=(o,r)=>{while(o){if(o===r)return true;o=o.parent;}return false;};
  const m={};
  for(const S of SOLIDS){
    if(!under(S.mesh,gV2)) continue;
    const xs=S.poly.map(q=>q[0]), ys=S.poly.map(q=>q[1]);
    const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
    const k=S.part+'|'+w.toFixed(0)+'|'+h.toFixed(0)+'|'+S.t;
    m[k]=(m[k]||0)+1;
  }
  return Object.entries(m).map(([k,n])=>{const[p,w,h,t]=k.split('|');return{p,w:+w,h:+h,t:+t,n};});
 });
 const STICKT=r=>(r.p==='頸脊'||r.p==='頸脊接合塊')?'—':r.t;
 const order=['底板','前板','後板','左側板','右側板','頂板','中段導板','轉頭導片','曲柄臂',
   '下顎凸輪','眼球凸輪','轉頭凸輪','點頭凸輪','下顎推桿','眼球推桿','轉頭叉口板','點頭升降板',
   '頸脊','頸脊項圈','轉盤組','頭骨主片','頸脊接合塊','下顎','下顎受推板','眼球橫桿','眼球受推板'];
 rows.sort((a,b)=>(order.indexOf(a.p)+99*(order.indexOf(a.p)<0))-(order.indexOf(b.p)+99*(order.indexOf(b.p)<0)));
 console.log('零件                外形(mm)        厚   數量   3mm 板做法');
 console.log('─'.repeat(74));
 for(const r of rows){
   const STICK={'頸脊':'方棒 8×6×110(或 3mm 板疊 2 層再裁 8 寬)','頸脊接合塊':'塊材 20×3×26(3mm 板疊 9 層,或用一小段方棒)'};
   const lay=STICK[r.p]||(r.t<=3?'1 層':(r.t/3)+' 層疊合');
   console.log(r.p.padEnd(12,'　')+String(r.w+' × '+r.h).padStart(14)+String(STICKT(r)).padStart(6)+String(r.n).padStart(6)+'   '+lay);
 }
 await b.close();
})();
