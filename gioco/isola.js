/* L'isola – scena di base per il gioco di maturità: isola con spiaggia, mare, palme, rocce, erba.
   Tutte le texture sono generate nel codice (nessun file da caricare). Gancio per il gioco: window.ISOLA */
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const $ = s => document.querySelector(s), QS = new URLSearchParams(location.search);
const LOW = QS.has('low') || /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent);
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = mul(2026), smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/* ---------- rumore (per la forma dell'isola) e rumore periodico (per le texture) ---------- */
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
const fbm = (x, y, o = 5) => { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vn(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= .5; } return s; };
function noiseTile(N, seed) { const r = mul(seed), v = new Float32Array(N * N).map(() => r());
  return (x, y) => { x *= N; y *= N; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy),
    a = v[(yi % N) * N + xi % N], b = v[(yi % N) * N + (xi + 1) % N], c = v[((yi + 1) % N) * N + xi % N], d = v[((yi + 1) % N) * N + (xi + 1) % N]; return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }; }

/* ---------- forma dell'isola: y = 0 è il livello del mare ---------- */
const R_ISLE = 150, SIZE = 520;   // R_ISLE = raggio dell'isola (m), SIZE = lato del terreno (m)
function height(x, z) {
  const shore = 1 - Math.hypot(x, z) / R_ISLE + (fbm(x * .012 + 5, z * .012 + 9, 4) - .5) * .55;   // > 0 = terra
  if (shore <= 0) return Math.max(-10, -Math.pow(-shore, .8) * 14);                                   // fondale che scende piano
  const beach = smooth(0, .16, shore), hills = smooth(.16, .7, shore) * (fbm(x * .02, z * .02, 5) * 14 + Math.pow(shore, 1.5) * 6);
  return beach * 1.3 + hills + (fbm(x * .15, z * .15, 3) - .5) * .25 * beach;                         // spiaggia dolce (~3°) poi colline
}

/* ---------- renderer, scena, luci ---------- */
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; document.body.prepend(renderer.domElement);
const scene = new T.Scene(), camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, .1, 3000);
const SUN = new T.Vector3(.2, .38, .9).normalize(), HOR = new T.Color().setRGB(.012, .026, .07);   // colori in lineare
scene.fog = new T.FogExp2(HOR, .0016);
const sun = new T.DirectionalLight(0x9db8ff, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 220 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = .04; scene.add(sun, sun.target);
scene.add(new T.HemisphereLight(0x233866, 0x1c1a22, .85));

/* ---------- cielo di giorno: gradiente, sole, nuvole ---------- */
const sky = new T.Mesh(new T.SphereGeometry(900, 32, 20), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, toneMapped: false, uniforms: { t: { value: 0 }, sunDir: { value: SUN } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform float t; uniform vec3 sunDir; varying vec3 vD;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float hs3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*ns(p);p=p*2.03+7.;a*=.5;}return s;}
float stars(vec3 d,float sc,float th){ vec3 p=d*sc,i=floor(p),f=fract(p)-.5; float h=hs3(i); vec3 j=(vec3(hs3(i+1.),hs3(i+2.),hs3(i+3.))-.5)*.6;
 return step(th,h)*pow(fract(h*91.7),2.)*(.75+.25*sin(t*(2.+h*5.)+h*80.))*smoothstep(.3,0.,length(f-j)); }
void main(){ vec3 d=normalize(vD); float y=max(d.y,0.);
 vec3 c=mix(vec3(.012,.026,.07),vec3(.0015,.004,.016),pow(y,.5));
 float mw=exp(-pow(dot(d,normalize(vec3(.6,.55,-.58)))*3.2,2.)); c+=vec3(.035,.042,.065)*mw*(.35+fb(vec2(d.x*6.+d.z*4.,d.y*6.+d.z*3.))*1.3);
 c+=vec3(.85,.9,1.)*(stars(d,170.,.93)*1.6+stars(d,80.,.965)*3.2)*smoothstep(.0,.25,d.y)*(1.+mw*1.5);
 float s=max(dot(d,sunDir),0.), disc=smoothstep(.99955,.9997,s);
 c+=vec3(.95,.95,.88)*disc*(.75+.25*fb(d.xy*70.+d.z*30.))*1.6+vec3(.5,.6,.9)*(pow(s,120.)*.18+pow(s,12.)*.04);
 c=mix(c,vec3(.012,.026,.07),smoothstep(.0,-.08,d.y));
 gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
}` })); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

/* ---------- sabbia: colore + rilievo (increspature del vento + grani), senza giunzioni ---------- */
function makeSand() {
  const S = 512, n1 = noiseTile(6, 1), n2 = noiseTile(24, 2), n3 = noiseTile(96, 3), n4 = noiseTile(256, 4), H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / S, v = y / S, w = n1(u, v) * .5;
    H[y * S + x] = Math.pow(.5 + .5 * Math.sin(6.2832 * (10 * u + 4 * v + w * 3)), 1.6) * .22 + n2(u, v) * .2 + n3(u, v) * .25 + n4(u, v) * .33; }
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; }, col = mk(), nor = mk(), cg = col.getContext('2d'), ng = nor.getContext('2d'), ci = cg.createImageData(S, S), ni = ng.createImageData(S, S);
  const h = (x, y) => H[((y + S) % S) * S + (x + S) % S];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), k = 2.2, l = Math.hypot(dx * k, dy * k, 1);
    ni.data[i] = (-dx * k / l * .5 + .5) * 255; ni.data[i + 1] = (dy * k / l * .5 + .5) * 255; ni.data[i + 2] = (1 / l * .5 + .5) * 255; ni.data[i + 3] = 255;
    const g = Math.min(255, 255 * (.62 + .55 * H[y * S + x] + (R() - .5) * .22)); ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = g; ci.data[i + 3] = 255; }
  cg.putImageData(ci, 0, 0); ng.putImageData(ni, 0, 0);
  const t = (c, s) => { const x = new T.CanvasTexture(c); x.wrapS = x.wrapT = T.RepeatWrapping; x.repeat.set(SIZE / 3, SIZE / 3); x.anisotropy = LOW ? 2 : 8; if (s) x.colorSpace = T.SRGBColorSpace; return x; };
  return { map: t(col, true), normalMap: t(nor, false) };
}

/* ---------- terreno: sabbia asciutta, sabbia bagnata vicino all'acqua, erba nell'interno, roccia sui pendii ---------- */
const sand = makeSand(), SEG = LOW ? 170 : 260, tg = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
{ const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i))); tg.computeVertexNormals();
  const nr = tg.attributes.normal, cl = new Float32Array(p.count * 3), DRY = [.73, .56, .31], WET = [.2, .14, .08], G1 = [.06, .12, .022], G2 = [.11, .15, .03], ROCK = [.17, .14, .12];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = p.getY(i), v = fbm(x * .05, z * .05, 3) - .5;
    let c = DRY.map(a => a * (1 + v * .3)); c = mix3(c, WET, h < 0 ? 1 : 1 - smooth(.1, .55, h));
    c = mix3(c, mix3(G1, G2, fbm(x * .1, z * .1, 3)), smooth(1.4, 3, h + v * 4)); c = mix3(c, ROCK, smooth(.05, .16, 1 - nr.getY(i)) * smooth(.2, 1.2, h));
    cl.set(c, i * 3); }
  tg.setAttribute('color', new T.BufferAttribute(cl, 3)); }
const terrain = new T.Mesh(tg, new T.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, normalScale: new T.Vector2(1.3, 1.3), vertexColors: true, roughness: 1 })); terrain.receiveShadow = true; scene.add(terrain);

/* ---------- mare: onde, trasparenza (si vede il fondale), turchese vicino a riva, schiuma che sale e scende sulla sabbia ---------- */
const HN = 384, hd = new Uint16Array(HN * HN);   // mappa delle altezze: serve al mare per sapere quanto è profondo
for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) hd[j * HN + i] = T.DataUtils.toHalfFloat((height(((i + .5) / HN - .5) * SIZE, ((j + .5) / HN - .5) * SIZE) + 10) / 20);
const hm = new T.DataTexture(hd, HN, HN, T.RedFormat, T.HalfFloatType); hm.minFilter = hm.magFilter = T.LinearFilter; hm.needsUpdate = true;
const WAVES = 'float wv(vec2 p,float t){return .18*sin(dot(vec2(.12,.05),p)+1.13*t)+.12*sin(dot(vec2(-.07,.11),p)+t);}';
const waterMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { t: { value: 0 }, hm: { value: hm }, sunDir: { value: SUN }, size: { value: SIZE } }]),
  vertexShader: `uniform float t; varying vec3 wp; ${WAVES}
#include <fog_pars_vertex>
void main(){ vec4 w=modelMatrix*vec4(position,1.); w.y+=wv(w.xz,t); wp=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `#include <common>
uniform float t,size; uniform sampler2D hm; uniform vec3 sunDir; varying vec3 wp;
#include <fog_pars_fragment>
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
vec3 skyc(vec3 d){float y=clamp(d.y,0.,1.);vec3 c=mix(vec3(.012,.026,.07),vec3(.0015,.004,.016),pow(y,.5));float s=max(dot(d,sunDir),0.);return c+vec3(.9,.95,1.)*(pow(s,1200.)*40.+pow(s,200.)*1.5)+vec3(.5,.6,.9)*pow(s,12.)*.04;}
void main(){ vec2 p=wp.xz, uv=p/size+.5;
 float g=(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)?texture2D(hm,uv).r*20.-10.:-10., depth=-g;
 vec2 gr=.18*cos(dot(vec2(.12,.05),p)+1.13*t)*vec2(.12,.05)+.12*cos(dot(vec2(-.07,.11),p)+t)*vec2(-.07,.11);
 vec2 q=p*.9+vec2(t*.3,t*.1); float r=ns(q); gr+=vec2(ns(q+vec2(.07,0.))-r,ns(q+vec2(0.,.07))-r)/.07*.06;
 q=p*3.1-vec2(t*.4,0.); r=ns(q); gr+=vec2(ns(q+vec2(.07,0.))-r,ns(q+vec2(0.,.07))-r)/.07*.025;
 vec3 N=normalize(vec3(-gr.x,1.,-gr.y)), V=normalize(cameraPosition-wp), Rf=reflect(-V,N); Rf.y=abs(Rf.y);
 float F=.02+.98*pow(1.-max(dot(N,V),0.),5.), k=1.-exp(-max(depth,0.)*.45);
 vec3 col=mix(mix(vec3(.004,.05,.055),vec3(.0006,.004,.014),k),skyc(Rf),F);
 float d2=depth-(.2*sin(t*.8-g*2.5)+.22), lace=ns(p*1.7+vec2(t*.1,0.))*.55+ns(p*6.-t*.15)*.45;
 float foam=clamp(smoothstep(.45,0.,d2)*smoothstep(.22,.7,lace+.28)+smoothstep(.07,0.,abs(d2))*.7,0.,1.)*step(-.05,depth);
 col=mix(col,vec3(.2,.24,.3),foam*.6);
 float a=max(mix(.28,.96,1.-exp(-max(depth,0.)*.9)),foam*.9)*smoothstep(-.12,.06,depth);
 gl_FragColor=vec4(col,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}` });
const wg = new T.PlaneGeometry(2600, 2600, 260, 260); wg.rotateX(-Math.PI / 2); const water = new T.Mesh(wg, waterMat); water.renderOrder = 1; water.frustumCulled = false; scene.add(water);

/* ---------- texture di palme, rocce, erba (disegnate al volo) ---------- */
const cv = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = LOW ? 2 : 4; return t; };
const frondTex = cv(512, 128, g => { g.lineCap = 'round';
  for (let i = 0; i < 62; i++) { const x = 14 + i * 7.9, L = 58 * Math.pow(Math.sin(Math.PI * (.1 + .9 * i / 61)), .7) + 6;
    for (const s of [-1, 1]) { g.strokeStyle = `hsl(${88 + R() * 22},${50 + R() * 16}%,${27 + R() * 20}%)`; g.lineWidth = 6.2 - i / 61 * 2.6; g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + L * .25, 64 + s * L * .7, x + L * .6, 64 + s * L); g.stroke(); } }
  g.strokeStyle = '#4d5a24'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 64); g.lineTo(505, 64); g.stroke(); });
const barkTex = cv(128, 256, (g, w, h) => { g.fillStyle = '#6e5f4c'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(30,22,14,.55)'; g.fillRect(0, y, w, 5); g.fillStyle = 'rgba(190,170,140,.18)'; g.fillRect(0, y + 8, w, 6); }
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() > .5 ? 255 : 0},${R() > .5 ? 235 : 0},${R() > .5 ? 200 : 0},.07)`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 5); } });
const rockTex = cv(256, 256, (g, w, h) => { g.fillStyle = '#85796c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { const k = R(); g.fillStyle = `rgba(${k > .5 ? 255 : 20},${k > .5 ? 250 : 18},${k > .5 ? 240 : 14},${.04 + R() * .08})`; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 9, 0, 6.283); g.fill(); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(25,20,15,.25)'; g.lineWidth = 1 + R() * 2; g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.lineTo(x + R() * 60 - 30, y + R() * 60 - 30); g.stroke(); } });
const grassTex = cv(128, 128, g => { for (let i = 0; i < 46; i++) { const x = 64 + (R() - .5) * 100, hh = 50 + R() * 70, b = (R() - .5) * 34; g.strokeStyle = `hsl(${78 + R() * 40},${50 + R() * 20}%,${22 + R() * 26}%)`; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + b * .3, 128 - hh * .5, x + b, 128 - hh); g.stroke(); } });
grassTex.wrapS = grassTex.wrapT = T.ClampToEdgeWrapping;

/* ---------- punti a caso sull'isola (altezza tra hmin e hmax) ---------- */
function pick(hmin, hmax, tries = 80) { for (let k = 0; k < tries; k++) { const a = R() * 6.283, r = Math.sqrt(R()) * R_ISLE * 1.25, x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z); if (h >= hmin && h <= hmax) return [x, z, h]; } return null; }

/* ---------- palme: tronco curvo con anelli + ciuffo di fronde ---------- */
const frondBase = (() => { const g = new T.PlaneGeometry(5.2, 2.3, 12, 1); g.rotateX(-Math.PI / 2); g.translate(2.5, 0, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, -Math.pow(p.getX(i) / 5, 2) * 1.5 - Math.abs(p.getZ(i)) * .32); g.computeVertexNormals(); return g; })();
const barkMat = new T.MeshStandardMaterial({ map: barkTex, roughness: .95 }), frondMat = new T.MeshStandardMaterial({ map: frondTex, alphaTest: .45, side: T.DoubleSide, roughness: .7 });
const frondDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: frondTex, alphaTest: .45 });   // l'ombra delle fronde segue la forma delle foglie
const nPalms = LOW ? 22 : 46;
for (let n = 0; n < nPalms; n++) { const s = pick(1.1, 3.4); if (!s) continue; const [x, z, gy] = s, h = 5.5 + R() * 4, lean = (R() * .18 + .05) * h, ld = Math.atan2(z, x) + (R() - .5) * 1.2;   // si piegano verso il mare
  const tr = new T.CylinderGeometry(.15, .26, h, 8, 10, true); tr.translate(0, h / 2, 0); const tp = tr.attributes.position, uv = tr.attributes.uv;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) / h; tp.setX(i, tp.getX(i) + Math.cos(ld) * lean * y * y); tp.setZ(i, tp.getZ(i) + Math.sin(ld) * lean * y * y); uv.setY(i, uv.getY(i) * h / 3); } tr.computeVertexNormals();
  const top = new T.Vector3(Math.cos(ld) * lean, h, Math.sin(ld) * lean), nf = LOW ? 8 : 11, fr = [];
  for (let k = 0; k < nf; k++) { const f = frondBase.clone(), sc = .8 + R() * .45; f.applyMatrix4(new T.Matrix4().compose(top, new T.Quaternion().setFromEuler(new T.Euler((R() - .5) * .5, k / nf * 6.283 + R() * .5, k % 3 ? .3 + R() * .55 : -.15 + R() * .2, 'YZX')), new T.Vector3(sc, sc, sc))); fr.push(f); }
  const tm = new T.Mesh(tr, barkMat), fm = new T.Mesh(mergeGeometries(fr), frondMat); fm.customDepthMaterial = frondDepth;
  for (const m of [tm, fm]) { m.position.set(x, gy - .1, z); m.castShadow = m.receiveShadow = true; scene.add(m); } }

/* ---------- rocce: sfere deformate dal rumore, mezze affondate nella sabbia o nell'acqua ---------- */
const rockMat = new T.MeshStandardMaterial({ map: rockTex, roughness: .95 }), vv = new T.Vector3();
function makeRock(seed) { const g = mergeVertices(new T.IcosahedronGeometry(1, 4)), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { vv.fromBufferAttribute(p, i); const r = .65 + fbm(vv.x * 1.4 + seed, vv.z * 1.4 + vv.y * 1.1) * .8; vv.multiplyScalar(r); vv.y *= .72; p.setXYZ(i, vv.x, vv.y, vv.z); } g.computeVertexNormals(); return g; }
for (let n = 0; n < (LOW ? 40 : 90); n++) { const big = n < 8, s = pick(big ? -2.2 : -.8, big ? .4 : 2.4); if (!s) continue; const sc = big ? 1.8 + R() * 1.8 : .25 + R() * R() * 1.4;
  const m = new T.Mesh(makeRock(R() * 90), rockMat); m.scale.set(sc * (.8 + R() * .5), sc, sc * (.8 + R() * .5)); m.position.set(s[0], s[2] - sc * .25, s[1]); m.rotation.y = R() * 6.283; m.castShadow = m.receiveShadow = true; scene.add(m); }

/* ---------- erba: ciuffi a croce (instancing) nell'entroterra ---------- */
{ const q = new T.PlaneGeometry(1.1, .8); q.translate(0, .4, 0); const q2 = q.clone(); q2.rotateY(Math.PI / 2); const GN = LOW ? 1600 : 4500;
  const gm = new T.InstancedMesh(mergeGeometries([q, q2]), new T.MeshStandardMaterial({ map: grassTex, alphaTest: .5, side: T.DoubleSide, roughness: 1 }), GN), M = new T.Matrix4(), col = new T.Color(); let c = 0;
  for (; c < GN;) { const s = pick(1.6, 7); if (!s) break; const sc = .7 + R() * .9; M.compose(new T.Vector3(s[0], s[2], s[1]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), R() * 6.283), new T.Vector3(sc, sc * (.8 + R() * .6), sc));
    gm.setMatrixAt(c, M); gm.setColorAt(c, col.setHSL(.2 + R() * .07, .35, .28 + R() * .2)); c++; }
  gm.count = c; gm.receiveShadow = true; scene.add(gm); }

/* ---------- giocatore: cammina sull'isola, può entrare in acqua fino alla vita ---------- */
const P = { x: 0, z: 0, yaw: 0, pitch: -.05, eye: 2.4, ph: 0 };
{ const a = 1.1; for (let r = R_ISLE * 1.3; r > 0; r -= .5) if (height(Math.cos(a) * r, Math.sin(a) * r) > .5) { P.x = Math.cos(a) * r; P.z = Math.sin(a) * r; break; } P.yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); }
const intro = { on: false, t: 0 }, keys = new Set(), joy = { x: 0, y: 0 }; let drag = null;
addEventListener('keydown', e => { keys.add(e.code); if (intro.on && (e.code === 'Space' || e.code === 'Escape')) intro.t = Math.max(intro.t, 10.4); }); addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', e => { if (!intro.on && !e.target.closest('#joy')) drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!drag) return; P.yaw -= (e.clientX - drag.x) * .004; P.pitch = Math.min(1.2, Math.max(-1.2, P.pitch - (e.clientY - drag.y) * .004)); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => drag = null); addEventListener('pointercancel', () => drag = null);
{ const el = $('#joy'), kn = el.firstElementChild, set = e => { const b = el.getBoundingClientRect(); let dx = e.clientX - b.left - 55, dy = e.clientY - b.top - 55; const l = Math.hypot(dx, dy), m = 45; if (l > m) { dx *= m / l; dy *= m / l; } joy.x = dx / m; joy.y = dy / m; kn.style.transform = `translate(${dx}px,${dy}px)`; };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); set(e); }); el.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') set(e); });
  const end = () => { joy.x = joy.y = 0; kn.style.transform = ''; }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.fov = innerHeight > innerWidth ? 74 : 60; camera.updateProjectionMatrix(); }); dispatchEvent(new Event('resize'));

/* ---------- suoni: onde, vento e grilli generati dal browser (nessun file audio) ---------- */
function startAudio() { const A = new (window.AudioContext || window.webkitAudioContext)(), M = A.createGain(); M.gain.value = 0; M.connect(A.destination); M.gain.linearRampToValueAtTime(.9, A.currentTime + 5);
  const nb = A.createBuffer(1, A.sampleRate * 4, A.sampleRate), d = nb.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  const layer = (type, f, q, vol, lf, depth) => { const s = A.createBufferSource(); s.buffer = nb; s.loop = true; const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = A.createGain(); g.gain.value = vol;
    const o = A.createOscillator(), og = A.createGain(); o.frequency.value = lf; og.gain.value = depth; o.connect(og); og.connect(g.gain); s.connect(fl); fl.connect(g); g.connect(M); s.start(); o.start(); };
  layer('lowpass', 650, .7, .26, .11, .18); layer('lowpass', 1400, .5, .08, .17, .07); layer('bandpass', 420, .8, .1, .06, .07);   // onde che vanno e vengono, vento
  const c = A.createOscillator(), cg = A.createGain(), cl = A.createOscillator(), cm = A.createGain(); c.frequency.value = 4300; cg.gain.value = .004; cl.type = 'square'; cl.frequency.value = 14; cm.gain.value = .004; cl.connect(cm); cm.connect(cg.gain); c.connect(cg); cg.connect(M); c.start(); cl.start();   // grilli
  ISOLA.audio = A; }
/* ---------- risveglio: occhi che si aprono, sguardo alle stelle, poi ci si alza ---------- */
const $l1 = $('#l1'), $l2 = $('#l2'), $sub = $('#sub'), LINES = [[1.8, 'Silenzio…'], [4.2, 'Dove… sono?'], [7.6, 'Non ricordo come sono arrivato qui.']];
function runIntro(dt, want) { intro.t += dt; const u = intro.t, e = (a, b) => smooth(a, b, u);
  const o = u < .8 ? 0 : u < 2.2 ? .35 * e(.8, 2.2) : u < 3 ? .35 - .3 * e(2.2, 3) : .05 + .95 * e(3, 5.5);   // palpebre: si socchiudono, si richiudono, poi si aprono
  $l1.style.height = $l2.style.height = (1 - o) * 50 + '%';
  P.pitch = 1.1 - 1.15 * e(5, 8.5); P.yaw = P.yaw0 + .9 * (1 - e(4.5, 8)); P.eye = .3 + (want - .3) * e(7, 10.5);
  let tx = ''; for (const [t0, s] of LINES) if (u >= t0 && u < t0 + 2.6) tx = s; if ($sub.textContent !== tx) $sub.textContent = tx;
  if (u > 10.8) { intro.on = false; document.body.classList.add('play'); $l1.remove(); $l2.remove(); $sub.textContent = ''; } }
$('#go').addEventListener('click', () => { document.body.classList.add('go'); P.yaw0 = P.yaw; P.pitch = 1.1; intro.on = true; intro.t = 0; startAudio(); });
const clock = new T.Clock(); let t = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(.05, clock.getDelta()); t += dt;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y, s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
  const l = intro.on ? 0 : Math.hypot(f, s); if (l > .05) { const g0 = height(P.x, P.z), sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.6 : 2.2) * (g0 < -.1 ? .55 : 1) * Math.min(1, l) / l;
    const dx = (-Math.sin(P.yaw) * f + Math.cos(P.yaw) * s) * sp * dt, dz = (-Math.cos(P.yaw) * f - Math.sin(P.yaw) * s) * sp * dt;
    if (height(P.x + dx, P.z + dz) > -1.1) { P.x += dx; P.z += dz; } else if (height(P.x + dx, P.z) > -1.1) P.x += dx; else if (height(P.x, P.z + dz) > -1.1) P.z += dz; P.ph += dt * sp * 2.6; }
  const want = Math.max(height(P.x, P.z), -.9) + 1.65 + (l > .05 ? Math.sin(P.ph) * .03 : 0); if (intro.on) runIntro(dt, want); else P.eye += (want - P.eye) * Math.min(1, dt * 10);
  camera.position.set(P.x, P.eye, P.z); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
  sky.position.copy(camera.position); sky.material.uniforms.t.value = t; waterMat.uniforms.t.value = t;
  sun.position.set(P.x, 0, P.z).addScaledVector(SUN, 90); sun.target.position.set(P.x, 0, P.z);
  renderer.render(scene, camera);
});
window.ISOLA = { T, scene, camera, renderer, height, player: P, intro, R_ISLE };   // gancio per il gioco (oggetti, regole, punteggio…)
setTimeout(() => { document.body.classList.add('ready'); $('#status').remove(); }, 400);
