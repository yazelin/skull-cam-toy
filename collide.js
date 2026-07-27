const { chromium } = require('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright');

const SCAN = () => {
  // ---- 幾何工具 ----
  const inPoly=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])) c=!c;}return c;};
  const inSolid2D=(u,v,S)=>{
    if(!inPoly([u,v],S.poly)) return false;
    for(const h of S.holes) if(inPoly([u,v],h)) return false;
    return true;
  };
  // 每片板產生內部取樣點(局部座標)
  const bbox2=(p)=>p.reduce((a,q)=>[Math.min(a[0],q[0]),Math.min(a[1],q[1]),Math.max(a[2],q[0]),Math.max(a[3],q[1])],[1e9,1e9,-1e9,-1e9]);
  for(const S of SOLIDS){
    const [x0,y0,x1,y1]=bbox2(S.poly);
    const area=(x1-x0)*(y1-y0);
    let step=Math.max(1.0,Math.sqrt(area/2500));
    const pts=[];
    const ws=[]; const wstep=Math.min(step,S.t/3);
    for(let w=wstep/2;w<S.t;w+=wstep) ws.push(S.w0+w);
    for(let u=x0+step/2;u<x1;u+=step) for(let v=y0+step/2;v<y1;v+=step)
      if(inSolid2D(u,v,S)) for(const w of ws) pts.push([u,v,w]);
    S.pts=pts; S.step=step;
  }
  // ---- 掃描 ----
  const under=(o,root)=>{while(o){if(o===root)return true;o=o.parent;}return false;};
  for(let i=SOLIDS.length-1;i>=0;i--) if(!under(SOLIDS[i].mesh,gV2)) SOLIDS.splice(i,1);
  const V=new THREE.Vector3(), inv=new THREE.Matrix4();
  const hits={};
  const N=72;
  for(let k=0;k<N;k++){
    const ang=k/N*Math.PI*2;
    updV2(gV2.userData.A,ang);
    gV2.updateMatrixWorld(true);
    // 世界 AABB(取樣點算,保守)
    for(const S of SOLIDS){
      let b=[1e9,1e9,1e9,-1e9,-1e9,-1e9]; const W=[];
      for(const p of S.pts){ V.set(p[0],p[1],p[2]).applyMatrix4(S.mesh.matrixWorld);
        W.push([V.x,V.y,V.z]);
        b[0]=Math.min(b[0],V.x);b[1]=Math.min(b[1],V.y);b[2]=Math.min(b[2],V.z);
        b[3]=Math.max(b[3],V.x);b[4]=Math.max(b[4],V.y);b[5]=Math.max(b[5],V.z);}
      S.W=W; S.box=b;
    }
    for(let i=0;i<SOLIDS.length;i++) for(let j=i+1;j<SOLIDS.length;j++){
      const A=SOLIDS[i],B=SOLIDS[j];
      if(A.part===B.part) continue;                       // 同一零件的多片不算
      const m=1.0;                                         // 留 1mm 容差,貼合不算干涉
      if(A.box[0]>B.box[3]-m||B.box[0]>A.box[3]-m||A.box[1]>B.box[4]-m||
         B.box[1]>A.box[4]-m||A.box[2]>B.box[5]-m||B.box[2]>A.box[5]-m) continue;
      // 點在對方實體內?(雙向)
      let n=0, ext=[1e9,1e9,1e9,-1e9,-1e9,-1e9];
      const test=(P,Q)=>{
        inv.copy(Q.mesh.matrixWorld).invert();
        for(const w of P.W){ V.set(w[0],w[1],w[2]).applyMatrix4(inv);
          if(V.z>Q.w0+0.5&&V.z<Q.w0+Q.t-0.5&&inSolid2D(V.x,V.y,Q)){
            n++; ext[0]=Math.min(ext[0],w[0]);ext[1]=Math.min(ext[1],w[1]);ext[2]=Math.min(ext[2],w[2]);
            ext[3]=Math.max(ext[3],w[0]);ext[4]=Math.max(ext[4],w[1]);ext[5]=Math.max(ext[5],w[2]);}}
      };
      test(A,B); test(B,A);
      if(n>0){
        const key=A.part+' ✕ '+B.part;
        const d=[ext[3]-ext[0],ext[4]-ext[1],ext[5]-ext[2]];
        if(!hits[key]) hits[key]={n:0,angles:[],size:[0,0,0],at:null};
        const H=hits[key]; H.n=Math.max(H.n,n); H.angles.push(Math.round(ang*180/Math.PI));
        if(!H.at||d[0]*d[1]*d[2]>=H.size[0]*H.size[1]*H.size[2]){H.size=d;H.at=[ext[0],ext[1],ext[2],ext[3],ext[4],ext[5]];}
      }
    }
  }
  return {solids:SOLIDS.map(s=>({part:s.part,n:s.pts.length,step:+s.step.toFixed(2)})), hits};
};

(async () => {
  const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const p = await b.newPage({viewport:{width:1200,height:700}});
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.goto('http://127.0.0.1:8099/index.html');
  await p.waitForTimeout(2000);
  await p.evaluate(()=>{playing=false;});
  const r = await p.evaluate(SCAN);
  console.log('登記的木片:', r.solids.length, ' 取樣點合計:', r.solids.reduce((a,s)=>a+s.n,0));
  const JOINT={'下顎 ✕ 下顎受推板':'榫接:受推板的榫穿過下顎片的榫孔(單邊 0.1mm 配合)',
               '眼球橫桿 ✕ 眼球受推板':'榫接:受推板的榫穿過眼球橫桿的榫孔'};
  for(const k of Object.keys(r.hits)) if(JOINT[k]){ console.log('  [已知榫接] '+k+' —— '+JOINT[k]); delete r.hits[k]; }
  const keys=Object.keys(r.hits);
  if(!keys.length){ console.log('\n>>> 全轉一圈,零干涉。'); }
  else{
    console.log('\n>>> 發現 '+keys.length+' 組干涉:\n');
    keys.sort((a,b)=>r.hits[b].n-r.hits[a].n).forEach(k=>{
      const h=r.hits[k], s=h.size.map(v=>v.toFixed(1)).join(' × ');
      const ang=h.angles.length>8?`${h.angles.length}/72 個角度`:h.angles.join('°,')+'°';
      console.log(`  ${k}\n     重疊體積約 ${s} mm  |  出現於 ${ang}  |  點數 ${h.n}`);
      console.log(`     位置 x[${h.at[0].toFixed(0)},${h.at[3].toFixed(0)}] z[${h.at[1].toFixed(0)},${h.at[4].toFixed(0)}] y[${h.at[2].toFixed(0)},${h.at[5].toFixed(0)}]`);
    });
  }
  await b.close();
})();
