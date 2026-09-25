(function(){
if (customElements.get('exyz-orb-game')) return;
const COLORS = ['#eb6c2b','#ff9a5c','#eb6c2b','#7c3aed','#f2f2f0'];
const SPR = {};
function sprite(col){
  if (SPR[col]) return SPR[col];
  const R = 64, c = document.createElement('canvas'); c.width = c.height = R*2;
  const x = c.getContext('2d'), g = x.createRadialGradient(R,R,0,R,R,R);
  g.addColorStop(0, col+'55'); g.addColorStop(1, col+'00');
  x.fillStyle = g; x.fillRect(0,0,R*2,R*2);
  x.fillStyle = col; x.beginPath(); x.arc(R,R,R/2.2,0,6.2832); x.fill();
  return SPR[col] = c;
}
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
class OrbGame extends HTMLElement {
  connectedCallback(){
    if (!this._c) this._setup();
    this._ro && this._ro.disconnect(); this._io && this._io.disconnect();
    this._ro = new ResizeObserver(()=>this._resize()); this._ro.observe(this);
    this._io = new IntersectionObserver(e=>{ this._vis = e[e.length-1].isIntersecting; if (this._vis) this._loop(); }); this._io.observe(this);
    requestAnimationFrame(()=>{ this._resize(); this._vis = true; this._loop(); });
    if (!this._onVis){ this._onVis = () => { if (!document.hidden && this._vis) this._loop(); }; document.addEventListener('visibilitychange', this._onVis); }
  }
  _setup(){
    this.style.display = 'block';
    this.style.position = 'relative';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.touchAction = 'manipulation';
    this.style.userSelect = 'none';
    const c = this._c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;';
    const m = 'linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%), linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)';
    c.style.webkitMaskImage = m; c.style.maskImage = m; c.style.webkitMaskComposite = 'source-in'; c.style.maskComposite = 'intersect';
    const hud = this._hud = document.createElement('div');
    hud.style.cssText = "position:absolute;right:0;top:0;pointer-events:none;font:500 11px 'JetBrains Mono',monospace;letter-spacing:.06em;color:#7a7a7a;";
    this.appendChild(hud);
    c.setAttribute('aria-label','Mini game: tap the orbs to set off a chain reaction');
    c.setAttribute('role','img');
    this.appendChild(c);
    this._ctx = c.getContext('2d');
    this._orbs = []; this._rings = []; this._bits = []; this._pops = [];
    this._score = 0; this._best = +(localStorage.getItem('exyz-orb-best')||0);
    this._hint = 1; this._chain = 0; this._chainT = 0;
    this._slow = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.4 : 1;
    c.addEventListener('pointerdown', e => {
      const r = c.getBoundingClientRect();
      this._tap(e.clientX - r.left, e.clientY - r.top);
    });
  }
  disconnectedCallback(){ this._ro && this._ro.disconnect(); this._io && this._io.disconnect(); cancelAnimationFrame(this._raf); }
  _resize(){
    const r = this.getBoundingClientRect(), d = Math.min(devicePixelRatio||1, MOBILE ? 1.5 : 2);
    if (!r.width || !r.height) return;
    this._w = r.width; this._h = r.height;
    this._c.width = r.width*d; this._c.height = r.height*d;
    this._ctx.setTransform(d,0,0,d,0,0);
    const target = Math.round(Math.max(MOBILE?8:10, Math.min(MOBILE?14:24, r.width*r.height/(MOBILE?11000:14000))));
    while (this._orbs.length < target) this._orbs.push(this._spawn(true));
    this._orbs.length = Math.min(this._orbs.length, target); this._target = target;
  }
  _spawn(anywhere){
    const w = this._w||400, h = this._h||400, s = 6 + Math.random()*16;
    return { x: 20 + Math.random()*(w-40), y: anywhere ? h*0.2 + Math.random()*h*0.6 : h + s + 10,
      r: s, vx: (Math.random()-.5)*.25, vy: -(.15 + Math.random()*.35), ph: Math.random()*6.28,
      col: COLORS[(Math.random()*COLORS.length)|0], a: anywhere ? 1 : 0 };
  }
  _tap(x,y){
    this._hint = 0; this._chain = 0;
    this._rings.push({x,y,r:4,max:70,a:1,user:1});
  }
  _pop(o){
    this._chain++; this._score += this._chain;
    this._rings.push({x:o.x,y:o.y,r:o.r,max:o.r*3.2+26,a:.9,col:o.col});
    for (let i=0,n=MOBILE?6:10;i<n;i++){ const a=Math.random()*6.28, v=.6+Math.random()*2.2;
      this._bits.push({x:o.x,y:o.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:1,col:o.col,s:1+Math.random()*2.2}); }
    if (this._chain > 1) this._pops.push({x:o.x,y:o.y-o.r-6,t:'x'+this._chain,l:1});
    this._chainT = 90;
    if (this._score > this._best){ this._best = this._score; try{localStorage.setItem('exyz-orb-best', this._best);}catch(e){} }
  }
  _loop(){
    cancelAnimationFrame(this._raf);
    const step = () => { if (!this._vis || document.hidden) { this._raf = 0; return; } this._tick(); this._draw(); this._raf = requestAnimationFrame(step); };
    this._raf = requestAnimationFrame(step);
  }
  _tick(){
    const w=this._w,h=this._h,k=this._slow,t=performance.now()/1000;
    for (const o of this._orbs){ o.x += (o.vx + Math.sin(t+o.ph)*.12)*k; o.y += o.vy*k; o.a = Math.min(1,o.a+.02);
      if (o.x<o.r) o.vx=Math.abs(o.vx); if (o.x>w-o.r) o.vx=-Math.abs(o.vx); }
    for (let i=this._orbs.length-1;i>=0;i--){ const o=this._orbs[i];
      if (o.y < -o.r-10) { this._orbs[i] = this._spawn(false); continue; }
      for (const r of this._rings){ const dx=o.x-r.x, dy=o.y-r.y;
        if (dx*dx+dy*dy < (r.r+o.r)*(r.r+o.r)) { this._pop(o); this._orbs.splice(i,1); break; } } }
    while (this._orbs.length < this._target && Math.random() < .04) this._orbs.push(this._spawn(false));
    for (const r of this._rings){ r.r += (r.max - r.r)*.12 + .4; r.a -= .03; }
    this._rings = this._rings.filter(r=>r.a>0 && r.r<r.max);
    for (const b of this._bits){ b.x+=b.vx; b.y+=b.vy; b.vx*=.95; b.vy*=.95; b.l-=.025; }
    this._bits = this._bits.filter(b=>b.l>0); if (this._bits.length > 160) this._bits.splice(0, this._bits.length-160);
    for (const p of this._pops){ p.y -= .5; p.l -= .018; }
    this._pops = this._pops.filter(p=>p.l>0);
    if (this._chainT>0 && --this._chainT===0) this._chain = 0;
  }
  _draw(){
    const x=this._ctx,w=this._w,h=this._h;
    x.clearRect(0,0,w,h);
    for (const o of this._orbs){
      const S = o.r*2.2; x.globalAlpha = o.a; x.drawImage(sprite(o.col), o.x-S, o.y-S, S*2, S*2);
    }
    x.globalAlpha = 1;
    for (const r of this._rings){ x.strokeStyle = r.user ? 'rgba(242,242,240,'+(r.a*.6)+')' : (r.col||'#eb6c2b'); x.globalAlpha = r.user?1:r.a*.8;
      x.lineWidth = r.user?1.5:2; x.beginPath(); x.arc(r.x,r.y,r.r,0,6.28); x.stroke(); }
    for (const b of this._bits){ x.globalAlpha=b.l; x.fillStyle=b.col; x.fillRect(b.x-b.s/2,b.y-b.s/2,b.s,b.s); }
    x.globalAlpha = 1;
    x.font = '600 12px "JetBrains Mono", monospace'; x.textAlign = 'center';
    for (const p of this._pops){ x.globalAlpha=p.l; x.fillStyle='#f2f2f0'; x.fillText(p.t,p.x,p.y); }
    x.globalAlpha = 1;
    const hs = 'SCORE ' + this._score + ' · BEST ' + this._best; if (this._hud.textContent !== hs) this._hud.textContent = hs;
    if (this._hint){ x.textAlign='center'; x.fillStyle='rgba(242,242,240,'+(.45+Math.sin(performance.now()/500)*.25)+')';
      x.font='500 12px "JetBrains Mono", monospace'; x.fillText('TAP TO POP · CHAIN THEM', w/2, h*0.74); }
  }
}
customElements.define('exyz-orb-game', OrbGame);
})();
