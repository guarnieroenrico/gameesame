/* L'isola – MULTIVERSE: Il viaggio tra le dimensioni
   Mappa procedurale con terreno ad alta fedeltà, illuminazione dinamica, fisica con collisioni,
   rimozione dei cespugli, nuova vegetazione e fiori, lanterne sul sentiero, passi sonori e portale. */
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = s => document.querySelector(s), QS = new URLSearchParams(location.search);
const LOW = QS.has('low') || /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent);
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const R = mul(2026), smooth = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/* ---------- rumore (per la forma dell'isola) e rumore periodico (per le texture) ---------- */
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const vn = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi,
        sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy),
        a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};
const fbm = (x, y, o = 5) => { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vn(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= .5; } return s; };
function noiseTile(N, seed) {
  const r = mul(seed), v = new Float32Array(N * N).map(() => r());
  return (x, y) => {
    x *= N; y *= N;
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi,
          sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy),
          a = v[(yi % N) * N + xi % N], b = v[(yi % N) * N + (xi + 1) % N],
          c = v[((yi + 1) % N) * N + xi % N], d = v[((yi + 1) % N) * N + (xi + 1) % N];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

/* ---------- forma dell'isola: y = 0 è il livello del mare ---------- */
const R_ISLE = 150, SIZE = 520;
function baseH(x, z) {
  const shore = 1 - Math.hypot(x, z) / R_ISLE + (fbm(x * .012 + 5, z * .012 + 9, 4) - .5) * .55;
  if (shore <= 0) return Math.max(-10, -Math.pow(-shore, .8) * 14);
  const beach = smooth(0, .16, shore), w = smooth(.14, .55, shore);
  const v = (fbm(x * .018 + 3, z * .018 + 7, 5) - .38) * 34 + Math.pow(1 - Math.abs(2 * fbm(x * .03 + 9, z * .03 + 2, 4) - 1), 2) * 10 + (fbm(x * .09, z * .09, 3) - .5) * 2.4 + shore * 5;
  return beach * 1.3 + w * (v > 0 ? v : v * .15) + (fbm(x * .15, z * .15, 3) - .5) * .25 * beach;
}

/* punto di risveglio, portale e sentiero che li collega */
const SP = (() => { const a = 1.1; for (let r = R_ISLE * 1.3; r > 0; r -= .5) if (baseH(Math.cos(a) * r, Math.sin(a) * r) > .5) return { x: Math.cos(a) * r, z: Math.sin(a) * r, a }; return { x: 0, z: 0, a }; })();
const a2 = SP.a + Math.PI + .35, slope = (x, z) => Math.max(Math.abs(baseH(x + 3, z) - baseH(x - 3, z)), Math.abs(baseH(x, z + 3) - baseH(x, z - 3))) / 6;
let PX = 0, PZ = 0, PY = 0, okP = false;
for (const o of [0, .25, -.25, .5, -.5, .75, -.75]) {
  for (let r = 95; r > 15 && !okP; r -= 2) {
    const x = Math.cos(a2 + o) * r, z = Math.sin(a2 + o) * r, h = baseH(x, z);
    if (h > 1.8 && h < 8 && slope(x, z) < .1) { PX = x; PZ = z; PY = h; okP = true; }
  }
}
if (!okP) { PX = Math.cos(a2) * 60; PZ = Math.sin(a2) * 60; PY = baseH(PX, PZ); }

const PATH = []; {
  const dx = PX - SP.x, dz = PZ - SP.z, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
  for (let i = 0; i <= 48; i++) {
    const s = i / 48, k = Math.sin(s * Math.PI), lat = (Math.sin(s * 7.2 + .7) * 11 + (fbm(s * 5, 3, 3) - .5) * 8) * k;
    PATH.push([SP.x + dx * s + nx * lat, SP.z + dz * s + nz * lat]);
  }
}
function pathDist(x, z) {
  let m = 1e9;
  for (let i = 0; i < 48; i++) {
    const [ax, az] = PATH[i], [qx, qz] = PATH[i + 1], vx = qx - ax, vz = qz - az,
          t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))),
          d = Math.hypot(x - ax - vx * t, z - az - vz * t);
    if (d < m) m = d;
  }
  return m;
}
function height(x, z) {
  let h = baseH(x, z);
  const dp = Math.hypot(x - PX, z - PZ);
  if (dp < 20) h += (PY - h) * (1 - smooth(8, 20, dp));
  if (h > .3) {
    const pd = pathDist(x, z);
    if (pd < 3) h -= (1 - smooth(1.2, 3, pd)) * .12;
  }
  return h;
}
function getSlope(x, z) {
  const d = 0.4;
  const dhx = height(x + d, z) - height(x - d, z);
  const dhz = height(x, z + d) - height(x, z - d);
  return Math.hypot(dhx, dhz) / (2 * d);
}

/* ---------- renderer, scena, luci ---------- */
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(60, innerWidth / innerHeight, .1, 3500);

// Luce e atmosfera naturale calda
const SUN = new T.Vector3(0.32, 0.48, 0.82).normalize();
const HOR = new T.Color().setRGB(0.55, 0.68, 0.86);
scene.fog = new T.FogExp2(HOR, 0.0014);

const sun = new T.DirectionalLight(0xfff2dc, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 240 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const hemi = new T.HemisphereLight(0x8eb8ff, 0x5a4836, 1.15);
scene.add(hemi);

/* ---------- cielo atmosferico con luce solare, nuvole e stelle d'alta quota ---------- */
const sky = new T.Mesh(new T.SphereGeometry(950, 32, 20), new T.ShaderMaterial({
  side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
  uniforms: { t: { value: 0 }, sunDir: { value: SUN } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform float t; uniform vec3 sunDir; varying vec3 vD;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float hs3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*ns(p);p=p*2.04+7.1;a*=.5;}return s;}
void main(){
  vec3 d=normalize(vD);
  float y=clamp(d.y, -0.1, 1.0);
  vec3 colHorizon = vec3(0.85, 0.74, 0.65);
  vec3 colSky = vec3(0.32, 0.58, 0.88);
  vec3 colZenith = vec3(0.12, 0.22, 0.48);
  vec3 c = mix(colHorizon, colSky, smoothstep(-0.02, 0.35, y));
  c = mix(c, colZenith, smoothstep(0.35, 0.95, y));
  float s = max(dot(d, sunDir), 0.0);
  float disc = smoothstep(0.9994, 0.9998, s);
  c += vec3(1.0, 0.96, 0.88) * disc * 4.5;
  c += vec3(1.0, 0.82, 0.55) * pow(s, 140.0) * 1.8;
  c += vec3(0.9, 0.65, 0.45) * pow(s, 16.0) * 0.45;
  if(y > 0.02){
    vec2 cuv = (d.xz / (d.y + 0.12)) * 0.14 + vec2(t * 0.003, t * 0.0015);
    float cloud = fb(cuv * 4.0);
    float cloudMask = smoothstep(0.44, 0.75, cloud) * smoothstep(0.02, 0.22, y);
    vec3 cloudLit = mix(vec3(0.88, 0.92, 0.98), vec3(1.0, 0.92, 0.82), pow(s, 3.0));
    vec3 cloudShade = vec3(0.55, 0.62, 0.78);
    vec3 cloudCol = mix(cloudShade, cloudLit, smoothstep(0.48, 0.68, cloud));
    c = mix(c, cloudCol, cloudMask * 0.75);
  }
  if(y > 0.48){
    vec3 sp = d * 140.0;
    vec3 si = floor(sp);
    float sh = hs3(si);
    if(sh > 0.975){
      float star = pow(fract(sh * 89.3), 3.0) * (0.6 + 0.4 * sin(t * 3.0 + sh * 40.0));
      c += vec3(0.85, 0.92, 1.0) * star * smoothstep(0.48, 0.85, y) * 1.6;
    }
  }
  c = mix(c, colHorizon, smoothstep(0.04, -0.06, y));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`
}));
sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

/* ---------- texture procedurali per il terreno (sabbia calda, rilievo normale) ---------- */
function makeTerrainTextures() {
  const S = 512, n1 = noiseTile(6, 1), n2 = noiseTile(24, 2), n3 = noiseTile(96, 3), n4 = noiseTile(256, 4), H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, w = n1(u, v) * .5;
    H[y * S + x] = Math.pow(.5 + .5 * Math.sin(6.2832 * (8 * u + 3 * v + w * 2.5)), 1.5) * .22 + n2(u, v) * .22 + n3(u, v) * .26 + n4(u, v) * .3;
  }
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; },
        col = mk(), nor = mk(), cg = col.getContext('2d'), ng = nor.getContext('2d'),
        ci = cg.createImageData(S, S), ni = ng.createImageData(S, S);
  const h = (x, y) => H[((y + S) % S) * S + (x + S) % S];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), k = 2.0, l = Math.hypot(dx * k, dy * k, 1);
    ni.data[i] = (-dx * k / l * .5 + .5) * 255;
    ni.data[i + 1] = (dy * k / l * .5 + .5) * 255;
    ni.data[i + 2] = (1 / l * .5 + .5) * 255;
    ni.data[i + 3] = 255;
    const val = 0.88 + 0.12 * H[y * S + x] + (R() - .5) * 0.05;
    ci.data[i] = Math.min(255, 238 * val);
    ci.data[i + 1] = Math.min(255, 228 * val);
    ci.data[i + 2] = Math.min(255, 212 * val);
    ci.data[i + 3] = 255;
  }
  cg.putImageData(ci, 0, 0); ng.putImageData(ni, 0, 0);
  const t = (c, s) => {
    const x = new T.CanvasTexture(c);
    x.wrapS = x.wrapT = T.RepeatWrapping;
    x.repeat.set(SIZE / 15, SIZE / 15);
    x.anisotropy = LOW ? 2 : 8;
    if (s) x.colorSpace = T.SRGBColorSpace;
    return x;
  };
  return { map: t(col, true), normalMap: t(nor, false) };
}

/* ---------- terreno: spiaggia dorata, erba rigogliosa, scogliere di roccia, sentiero ---------- */
const terrainTex = makeTerrainTextures(), SEG = LOW ? 200 : 340, tg = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
tg.rotateX(-Math.PI / 2);
{
  const p = tg.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  tg.computeVertexNormals();
  const nr = tg.attributes.normal, cl = new Float32Array(p.count * 3);
  const DRY_SAND = [0.88, 0.76, 0.52], WET_SAND = [0.46, 0.36, 0.25];
  const GRASS_LUSH = [0.32, 0.60, 0.18], GRASS_DEEP = [0.22, 0.46, 0.13], GRASS_WARM = [0.44, 0.68, 0.22];
  const ROCK = [0.48, 0.46, 0.44], ROCK_DARK = [0.36, 0.34, 0.32];
  const PATH_DIRT = [0.60, 0.46, 0.30], PLAZA_STONE = [0.42, 0.42, 0.48];

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = p.getY(i);
    const slopeVal = 1 - nr.getY(i);
    const noise1 = fbm(x * 0.04, z * 0.04, 3) - 0.5;
    const noise2 = fbm(x * 0.12 + 10, z * 0.12 + 20, 3) - 0.5;

    let c = DRY_SAND.map(v => v * (1 + noise1 * 0.18));
    c = mix3(c, WET_SAND, h < 0 ? 1 : 1 - smooth(0.05, 0.65, h));

    const grassBlend = smooth(0.8, 2.5, h + noise1 * 3.0);
    const grassColor = mix3(GRASS_LUSH, mix3(GRASS_DEEP, GRASS_WARM, noise2 + 0.5), smooth(3.0, 10.0, h));
    c = mix3(c, grassColor, grassBlend);

    const rockBlend = smooth(0.12, 0.32, slopeVal) * smooth(0.4, 2.0, h);
    const rockColor = mix3(ROCK, ROCK_DARK, noise1 + 0.5);
    c = mix3(c, rockColor, rockBlend);

    c = mix3(c, ROCK, smooth(14.0, 22.0, h) * 0.8);

    if (h > 0.2) {
      const pd = pathDist(x, z);
      const trailBlend = (1 - smooth(0.8, 2.5, pd)) * 0.88;
      c = mix3(c, PATH_DIRT, trailBlend);
    }

    const distPortal = Math.hypot(x - PX, z - PZ);
    const plazaBlend = 1 - smooth(6.2, 9.5, distPortal);
    c = mix3(c, PLAZA_STONE, plazaBlend);

    cl.set(c, i * 3);
  }
  tg.setAttribute('color', new T.BufferAttribute(cl, 3));
}
const terrain = new T.Mesh(tg, new T.MeshStandardMaterial({
  map: terrainTex.map, normalMap: terrainTex.normalMap, normalScale: new T.Vector2(0.9, 0.9),
  vertexColors: true, roughness: 0.86, metalness: 0.04
}));
terrain.receiveShadow = true; scene.add(terrain);

/* ---------- mare cristallino tropicale: trasparenza fondale, schiuma onde, riflessi ---------- */
const HN = 384, hd = new Uint16Array(HN * HN);
for (let j = 0; j < HN; j++) for (let i = 0; i < HN; i++) {
  hd[j * HN + i] = T.DataUtils.toHalfFloat((height(((i + .5) / HN - .5) * SIZE, ((j + .5) / HN - .5) * SIZE) + 10) / 20);
}
const hm = new T.DataTexture(hd, HN, HN, T.RedFormat, T.HalfFloatType);
hm.minFilter = hm.magFilter = T.LinearFilter; hm.needsUpdate = true;
const WAVES = 'float wv(vec2 p,float t){return .18*sin(dot(vec2(.12,.05),p)+1.13*t)+.12*sin(dot(vec2(-.07,.11),p)+t);}';
const waterMat = new T.ShaderMaterial({
  transparent: true, depthWrite: false, fog: true,
  uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { t: { value: 0 }, hm: { value: hm }, sunDir: { value: SUN }, size: { value: SIZE } }]),
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
vec3 skyc(vec3 d){
  float y=clamp(d.y,0.,1.);
  vec3 c=mix(vec3(0.85,0.74,0.65),vec3(0.32,0.58,0.88),pow(y,.4));
  float s=max(dot(d,sunDir),0.);
  return c+vec3(1.0,0.95,0.85)*(pow(s,800.)*35.+pow(s,120.)*2.);
}
void main(){
  vec2 p=wp.xz, uv=p/size+.5;
  float g=(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)?texture2D(hm,uv).r*20.-10.:-10., depth=-g;
  vec2 gr=.18*cos(dot(vec2(.12,.05),p)+1.13*t)*vec2(.12,.05)+.12*cos(dot(vec2(-.07,.11),p)+t)*vec2(-.07,.11);
  vec2 q=p*.9+vec2(t*.3,t*.1); float r=ns(q); gr+=vec2(ns(q+vec2(.07,0.))-r,ns(q+vec2(0.,.07))-r)/.07*.06;
  q=p*3.1-vec2(t*.4,0.); r=ns(q); gr+=vec2(ns(q+vec2(.07,0.))-r,ns(q+vec2(0.,.07))-r)/.07*.025;
  vec3 N=normalize(vec3(-gr.x,1.,-gr.y)), V=normalize(cameraPosition-wp), Rf=reflect(-V,N); Rf.y=abs(Rf.y);
  float F=.04+.96*pow(1.-max(dot(N,V),0.),5.), k=1.-exp(-max(depth,0.)*.35);
  vec3 shallowCol = vec3(0.06, 0.52, 0.62);
  vec3 deepCol = vec3(0.015, 0.14, 0.32);
  vec3 waterBase = mix(shallowCol, deepCol, k);
  vec3 col = mix(waterBase, skyc(Rf), F);
  float spec = pow(max(dot(Rf, sunDir), 0.0), 160.0) * 2.5;
  col += vec3(1.0, 0.96, 0.88) * spec;
  float d2 = depth-(.22*sin(t*1.1-g*2.8)+.20), lace=ns(p*2.2+vec2(t*.15,0.))*.55+ns(p*7.-t*.2)*.45;
  float foam=clamp(smoothstep(.42,0.,d2)*smoothstep(.2,.65,lace+.3)+smoothstep(.08,0.,abs(d2))*.75,0.,1.)*step(-.05,depth);
  col=mix(col,vec3(.95,.98,1.),foam*.9);
  float a=max(mix(.35,.95,1.-exp(-max(depth,0.)*.8)),foam*.95)*smoothstep(-.12,.06,depth);
  gl_FragColor=vec4(col,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`
});
const wg = new T.PlaneGeometry(2800, 2800, 260, 260); wg.rotateX(-Math.PI / 2);
const water = new T.Mesh(wg, waterMat); water.renderOrder = 1; water.frustumCulled = false; scene.add(water);

/* ---------- texture ausiliarie ---------- */
const cv = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = LOW ? 2 : 4; return t; };

const frondTex = cv(512, 160, g => {
  g.lineCap = 'round';
  for (let i = 0; i < 96; i++) {
    const x = 8 + i * 5.2, L = 68 * Math.pow(Math.sin(Math.PI * (.08 + .92 * i / 95)), .65) + 8;
    for (const s of [-1, 1]) {
      g.strokeStyle = `hsl(${88 + R() * 28},${50 + R() * 20}%,${32 + R() * 20}%)`;
      g.lineWidth = 3.4 - i / 95 * 1.8;
      g.beginPath(); g.moveTo(x, 80);
      g.quadraticCurveTo(x + L * .1, 80 + s * L * .55, x + L * .5, 80 + s * L);
      g.stroke();
    }
  }
  g.strokeStyle = '#59652c'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(0, 80); g.lineTo(508, 80); g.stroke();
});

const barkTex = cv(128, 256, (g, w, h) => {
  g.fillStyle = '#786852'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 28) {
    g.fillStyle = 'rgba(40,28,18,.55)'; g.fillRect(0, y, w, 5);
    g.fillStyle = 'rgba(210,185,150,.2)'; g.fillRect(0, y + 7, w, 6);
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${R() > .5 ? 255 : 0},${R() > .5 ? 235 : 0},${R() > .5 ? 200 : 0},.07)`;
    g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 5);
  }
});

const rockTex = cv(256, 256, (g, w, h) => {
  g.fillStyle = '#8e8276'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) {
    const k = R();
    g.fillStyle = `rgba(${k > .5 ? 255 : 20},${k > .5 ? 250 : 18},${k > .5 ? 240 : 14},${.04 + R() * .08})`;
    g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 9, 0, 6.283); g.fill();
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = 'rgba(25,20,15,.25)'; g.lineWidth = 1 + R() * 2;
    g.beginPath(); const x = R() * w, y = R() * h; g.moveTo(x, y); g.lineTo(x + R() * 60 - 30, y + R() * 60 - 30); g.stroke();
  }
});

const grassTex = cv(128, 128, g => {
  for (let i = 0; i < 50; i++) {
    const x = 64 + (R() - .5) * 100, hh = 50 + R() * 70, b = (R() - .5) * 34;
    g.strokeStyle = `hsl(${82 + R() * 38},${55 + R() * 20}%,${26 + R() * 24}%)`; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + b * .3, 128 - hh * .5, x + b, 128 - hh); g.stroke();
  }
});
grassTex.wrapS = grassTex.wrapT = T.ClampToEdgeWrapping;

// Texture per fiori colorati nei prati
const flowerTex = cv(128, 128, g => {
  const cx = 64, cy = 64;
  g.fillStyle = '#487228'; g.fillRect(60, 64, 8, 64);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    g.fillStyle = '#ffffff'; g.beginPath();
    g.ellipse(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 14, 8, a, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#ffd13b'; g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fill();
});
flowerTex.wrapS = flowerTex.wrapT = T.ClampToEdgeWrapping;

/* ---------- registro delle collisioni per la fisica ---------- */
const colliders = [];

/* ---------- punti casuali sull'isola ---------- */
function pick(hmin, hmax, tries = 80) {
  for (let k = 0; k < tries; k++) {
    const a = R() * 6.283, r = Math.sqrt(R()) * R_ISLE * 1.25, x = Math.cos(a) * r, z = Math.sin(a) * r, h = height(x, z);
    if (h >= hmin && h <= hmax && pathDist(x, z) > 2.6 && Math.hypot(x - PX, z - PZ) > 10) return [x, z, h];
  }
  return null;
}

/* ---------- palme tropicali con cocchi e collisioni ---------- */
const frondBase = (() => {
  const g = new T.PlaneGeometry(5.4, 3.1, 14, 1); g.rotateX(-Math.PI / 2); g.translate(2.7, 0, 0); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, -Math.pow(p.getX(i) / 5.4, 2) * 1.7 - Math.abs(p.getZ(i)) * .42);
  g.computeVertexNormals(); return g;
})();
const barkMat = new T.MeshStandardMaterial({ map: barkTex, roughness: .92 }),
      frondMat = new T.MeshStandardMaterial({ map: frondTex, alphaTest: .45, side: T.DoubleSide, roughness: .68, emissive: 0x1d3a12 });
const frondDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: frondTex, alphaTest: .45 });
const coconutGeo = new T.SphereGeometry(0.18, 7, 7);
const coconutMat = new T.MeshStandardMaterial({ color: 0x422f1d, roughness: 0.9 });

const nPalms = LOW ? 28 : 72;
for (let n = 0; n < nPalms; n++) {
  const s = pick(1.1, 9); if (!s) continue;
  const [x, z, gy] = s, h = 5.5 + R() * 4, lean = (R() * .18 + .05) * h, ld = Math.atan2(z, x) + (R() - .5) * 1.2;
  const tr = new T.CylinderGeometry(.16, .28, h, 8, 10, true); tr.translate(0, h / 2, 0);
  const tp = tr.attributes.position, uv = tr.attributes.uv;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) / h;
    tp.setX(i, tp.getX(i) + Math.cos(ld) * lean * y * y);
    tp.setZ(i, tp.getZ(i) + Math.sin(ld) * lean * y * y);
    uv.setY(i, uv.getY(i) * h / 3);
  }
  tr.computeVertexNormals();

  const top = new T.Vector3(Math.cos(ld) * lean, h, Math.sin(ld) * lean), nf = LOW ? 9 : 14, fr = [];
  for (let k = 0; k < nf; k++) {
    const f = frondBase.clone(), sc = .9 + R() * .4;
    f.applyMatrix4(new T.Matrix4().compose(top, new T.Quaternion().setFromEuler(new T.Euler((R() - .5) * .5, k / nf * 6.283 + R() * .5, k % 3 ? .3 + R() * .55 : -.15 + R() * .2, 'YZX')), new T.Vector3(sc, sc, sc)));
    fr.push(f);
  }
  const tm = new T.Mesh(tr, barkMat), fm = new T.Mesh(mergeGeometries(fr), frondMat);
  fm.customDepthMaterial = frondDepth;
  for (const m of [tm, fm]) { m.position.set(x, gy - .1, z); m.castShadow = m.receiveShadow = true; scene.add(m); }

  // Grappolo di noci di cocco sotto la chioma
  for (let c = 0; c < 3; c++) {
    const coc = new T.Mesh(coconutGeo, coconutMat);
    coc.position.set(x + top.x + (R() - .5) * .28, gy + top.y - .22 + (R() - .5) * .12, z + top.z + (R() - .5) * .28);
    coc.castShadow = true; scene.add(coc);
  }

  // Registra collisione fusto della palma
  colliders.push({ x, z, r: 0.58, type: 'palm' });
}

/* ---------- rocce dettagliate con collisione ---------- */
const rockMat = new T.MeshStandardMaterial({ map: rockTex, roughness: .94 }), vv = new T.Vector3();
function makeRock(seed) {
  const g = mergeVertices(new T.IcosahedronGeometry(1, 4)), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    vv.fromBufferAttribute(p, i);
    const r = .65 + fbm(vv.x * 1.4 + seed, vv.z * 1.4 + vv.y * 1.1) * .8;
    vv.multiplyScalar(r); vv.y *= .72; p.setXYZ(i, vv.x, vv.y, vv.z);
  }
  g.computeVertexNormals(); return g;
}
for (let n = 0; n < (LOW ? 50 : 120); n++) {
  const big = n < 8, mid = n >= 8 && n < 28, s = pick(big ? -2.2 : mid ? 3 : -.8, big ? .4 : mid ? 16 : 14);
  if (!s) continue;
  const sc = big ? 1.8 + R() * 1.8 : mid ? 1 + R() * 1.6 : .25 + R() * R() * 1.4;
  const m = new T.Mesh(makeRock(R() * 90), rockMat);
  m.scale.set(sc * (.8 + R() * .5), sc, sc * (.8 + R() * .5));
  m.position.set(s[0], s[2] - sc * .25, s[1]);
  m.rotation.y = R() * 6.283;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);

  // Le rocce medie e grandi hanno collisione fisica solida
  if (sc >= 0.38) {
    colliders.push({ x: s[0], z: s[1], r: sc * 0.82, type: 'rock' });
  }
}

/* ---------- ciuffi d'erba fitta nell'entroterra ---------- */
{
  const q = new T.PlaneGeometry(1.1, .8); q.translate(0, .4, 0); const q2 = q.clone(); q2.rotateY(Math.PI / 2);
  const GN = LOW ? 2400 : 7500;
  const gm = new T.InstancedMesh(mergeGeometries([q, q2]), new T.MeshStandardMaterial({ map: grassTex, alphaTest: .48, side: T.DoubleSide, roughness: .95 }), GN),
        M = new T.Matrix4(), col = new T.Color();
  let c = 0;
  for (; c < GN;) {
    const s = pick(1.5, 12); if (!s) break;
    const sc = .7 + R() * .9;
    M.compose(new T.Vector3(s[0], s[2], s[1]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), R() * 6.283), new T.Vector3(sc, sc * (.8 + R() * .6), sc));
    gm.setMatrixAt(c, M);
    gm.setColorAt(c, col.setHSL(.22 + R() * .08, .55, .32 + R() * .22));
    c++;
  }
  gm.count = c; gm.receiveShadow = true; scene.add(gm);
}

/* ---------- prati di fiori colorati (sostituiscono i vecchi cespugli) ---------- */
{
  const fq = new T.PlaneGeometry(0.7, 0.7); fq.translate(0, 0.35, 0); const fq2 = fq.clone(); fq2.rotateY(Math.PI / 2);
  const FN = LOW ? 400 : 1200;
  const flowerMesh = new T.InstancedMesh(mergeGeometries([fq, fq2]), new T.MeshStandardMaterial({
    map: flowerTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.8
  }), FN);
  const M = new T.Matrix4(), col = new T.Color();
  const flowerPalette = [0xffd13b, 0xffffff, 0xf04860, 0xb678f5, 0xff9944];
  let fc = 0;
  for (; fc < FN;) {
    const p = pick(1.8, 14); if (!p) break;
    const sc = 0.5 + R() * 0.7;
    M.compose(new T.Vector3(p[0], p[2], p[1]), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), R() * 6.283), new T.Vector3(sc, sc, sc));
    flowerMesh.setMatrixAt(fc, M);
    const chosen = flowerPalette[Math.floor(R() * flowerPalette.length)];
    flowerMesh.setColorAt(fc, col.setHex(chosen));
    fc++;
  }
  flowerMesh.count = fc; flowerMesh.receiveShadow = true; scene.add(flowerMesh);
}

/* ---------- lanterne antiche in pietra lungo il sentiero (illuminazione e guida) ---------- */
const lanternMat = new T.MeshStandardMaterial({ map: rockTex, color: 0x6e6862, roughness: 0.85 });
const lanternGlowMat = new T.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 2.2 });
const lanternPositions = [0.08, 0.20, 0.36, 0.52, 0.68, 0.82, 0.92];
for (const s of lanternPositions) {
  const f = s * 48, idx = Math.min(47, Math.floor(f)), u = f - idx,
        [ax, az] = PATH[idx], [qx, qz] = PATH[idx + 1],
        tx = qx - ax, tz = qz - az, len = Math.hypot(tx, tz),
        side = (s * 100) % 2 === 0 ? 1.6 : -1.6,
        lx = ax + tx * u - tz / len * side, lz = az + tz * u + tx / len * side,
        ly = height(lx, lz);

  const lantern = new T.Group();
  lantern.position.set(lx, ly, lz);

  const base = new T.Mesh(new T.CylinderGeometry(0.24, 0.32, 0.8, 8), lanternMat);
  base.position.y = 0.4;
  const core = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.25, 8), lanternGlowMat);
  core.position.y = 0.92;
  const cap = new T.Mesh(new T.ConeGeometry(0.3, 0.3, 8), lanternMat);
  cap.position.y = 1.18;

  lantern.add(base, core, cap);
  lantern.traverse(child => { if (child.isMesh) child.castShadow = true; });
  scene.add(lantern);

  const light = new T.PointLight(0xffa244, 0.9, 8, 2);
  light.position.set(lx, ly + 0.95, lz);
  scene.add(light);

  colliders.push({ x: lx, z: lz, r: 0.48, type: 'lantern' });
}

/* ---------- particelle luminose magiche nell'aria (multiverso) ---------- */
const MOTE_COUNT = 90, motePos = new Float32Array(MOTE_COUNT * 3);
const moteSeeds = Array.from({ length: MOTE_COUNT }, () => {
  const s = pick(1.5, 12) || [0, 0, 3];
  return { x: s[0], z: s[1], y0: s[2] + 0.8 + R() * 2.2, sp: 0.5 + R() * 0.8, rad: 0.5 + R() * 1.5, ph: R() * 6.28 };
});
const motesGeo = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(motePos, 3));
const motesMat = new T.PointsMaterial({ size: 0.16, color: 0xc4dcff, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false });
const motes = new T.Points(motesGeo, motesMat);
motes.frustumCulled = false; scene.add(motes);

/* ---------- giocatore e fisica solida ---------- */
const P = { x: 0, z: 0, yaw: 0, pitch: -.05, eye: 2.4, ph: 0, jy: 0, jv: 0, stepTimer: 0 };
P.x = SP.x; P.z = SP.z; P.yaw = Math.atan2(-Math.cos(SP.a), -Math.sin(SP.a));
const intro = { on: false, t: 0 }, ui = { open: false }, keys = new Set(), joy = { x: 0, y: 0 }; let drag = null;

// Risoluzione delle collisioni con scivolamento
const PLAYER_R = 0.42;
function movePlayerWithCollision(curX, curZ, moveX, moveZ) {
  if (Math.hypot(moveX, moveZ) < 0.0001) return [curX, curZ];

  const maxStep = 0.12;
  const dist = Math.hypot(moveX, moveZ);
  const steps = Math.ceil(dist / maxStep);
  const sx = moveX / steps, sz = moveZ / steps;

  let px = curX, pz = curZ;

  for (let s = 0; s < steps; s++) {
    let nx = px + sx, nz = pz + sz;

    // Limite acqua e perimetro isola
    const h = height(nx, nz), r = Math.hypot(nx, nz);
    if (h < -1.1 || r > R_ISLE * 1.32) {
      const canX = height(nx, pz) >= -1.1 && Math.hypot(nx, pz) <= R_ISLE * 1.32;
      const canZ = height(px, nz) >= -1.1 && Math.hypot(px, nz) <= R_ISLE * 1.32;
      if (canX && !canZ) nz = pz;
      else if (canZ && !canX) nx = px;
      else continue;
    }

    // Pendenze impraticabili (pareti verticali di roccia)
    const curH = height(px, pz), nextH = height(nx, nz);
    if (nextH - curH > 0.35 && getSlope(nx, nz) > 1.12) {
      const canX = getSlope(nx, pz) <= 1.12;
      const canZ = getSlope(px, nz) <= 1.12;
      if (canX && !canZ) nz = pz;
      else if (canZ && !canX) nx = px;
      else continue;
    }

    // Collisione circolare solida con scivolamento (alberi, rocce, oggetti)
    for (let iter = 0; iter < 3; iter++) {
      let hit = false;
      for (let i = 0; i < colliders.length; i++) {
        const col = colliders[i];
        const dx = nx - col.x, dz = nz - col.z;
        const minDist = col.r + PLAYER_R;
        if (Math.abs(dx) > minDist || Math.abs(dz) > minDist) continue;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          hit = true;
          const d = Math.sqrt(distSq);
          if (d > 0.001) {
            const push = minDist - d;
            nx += (dx / d) * push;
            nz += (dz / d) * push;
          } else {
            nx += minDist;
          }
        }
      }
      if (!hit) break;
    }

    px = nx;
    pz = nz;
  }

  return [px, pz];
}

addEventListener('keydown', e => {
  const ae = document.activeElement;
  if (started && ae && ae !== document.body && ae.blur) ae.blur();
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (started && e.code === 'Enter')) e.preventDefault();
  keys.add(e.code);
  if (intro.on && (e.code === 'Space' || e.code === 'Escape')) intro.t = Math.max(intro.t, 10.4);
  if (e.code === 'Space' && !e.repeat && !intro.on && !ui.open && P.jy === 0) P.jv = 4.8;
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); drag = null; });
document.addEventListener('visibilitychange', () => { keys.clear(); drag = null; });

addEventListener('pointerdown', e => {
  if (!intro.on && !ui.open && !e.target.closest('#joy, #panel, #end, #start, button')) drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointermove', e => {
  if (!drag) return;
  P.yaw -= (e.clientX - drag.x) * .0038;
  P.pitch = Math.min(1.2, Math.max(-1.2, P.pitch - (e.clientY - drag.y) * .0038));
  drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => drag = null);
addEventListener('pointercancel', () => drag = null);

{
  const el = $('#joy'), kn = el.firstElementChild, set = e => {
    const b = el.getBoundingClientRect();
    let dx = e.clientX - b.left - 55, dy = e.clientY - b.top - 55;
    const l = Math.hypot(dx, dy), m = 45;
    if (l > m) { dx *= m / l; dy *= m / l; }
    joy.x = dx / m; joy.y = dy / m;
    kn.style.transform = `translate(${dx}px,${dy}px)`;
  };
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); set(e); });
  el.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') set(e); });
  const end = () => { joy.x = joy.y = 0; kn.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerHeight > innerWidth ? 74 : 60;
  camera.updateProjectionMatrix();
});
dispatchEvent(new Event('resize'));

/* ---------- suoni procedurali: ambiente e passi sul terreno ---------- */
function startAudio() {
  if (ISOLA.audio) return;
  const A = new (window.AudioContext || window.webkitAudioContext)(), M = A.createGain();
  M.gain.value = 0; M.connect(A.destination); M.gain.linearRampToValueAtTime(.9, A.currentTime + 5);
  const nb = A.createBuffer(1, A.sampleRate * 4, A.sampleRate), d = nb.getChannelData(0);
  let l = 0;
  for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  const layer = (type, f, q, vol, lf, depth) => {
    const s = A.createBufferSource(); s.buffer = nb; s.loop = true;
    const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = A.createGain(); g.gain.value = vol;
    const o = A.createOscillator(), og = A.createGain(); o.frequency.value = lf; og.gain.value = depth;
    o.connect(og); og.connect(g.gain); s.connect(fl); fl.connect(g); g.connect(M); s.start(); o.start();
  };
  layer('lowpass', 650, .7, .26, .11, .18);
  layer('lowpass', 1400, .5, .08, .17, .07);
  layer('bandpass', 420, .8, .1, .06, .07);
  const c = A.createOscillator(), cg = A.createGain(), cl = A.createOscillator(), cm = A.createGain();
  c.frequency.value = 4300; cg.gain.value = .004; cl.type = 'square'; cl.frequency.value = 14; cm.gain.value = .004;
  cl.connect(cm); cm.connect(cg.gain); c.connect(cg); cg.connect(M); c.start(); cl.start();
  const ho = A.createOscillator(), hf = A.createBiquadFilter(), hg = A.createGain();
  ho.type = 'sawtooth'; ho.frequency.value = 55; hf.type = 'lowpass'; hf.frequency.value = 220; hg.gain.value = 0;
  ho.connect(hf); hf.connect(hg); hg.connect(M); ho.start(); A.hum = hg;
  ISOLA.audio = A;
}

function playFootstep(type) {
  if (!ISOLA.audio || intro.on || ui.open) return;
  const A = ISOLA.audio, now = A.currentTime;
  if (type === 'water') {
    const osc = A.createOscillator(), g = A.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.11);
    g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g); g.connect(A.destination); osc.start(now); osc.stop(now + 0.12);
  } else if (type === 'stone') {
    const osc = A.createOscillator(), g = A.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(320, now); osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g); g.connect(A.destination); osc.start(now); osc.stop(now + 0.09);
  } else if (type === 'sand') {
    const buf = A.createBuffer(1, A.sampleRate * 0.08, A.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (A.sampleRate * 0.02));
    const src = A.createBufferSource(); src.buffer = buf;
    const filter = A.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
    const g = A.createGain(); g.gain.value = 0.04;
    src.connect(filter); filter.connect(g); g.connect(A.destination); src.start(now);
  } else {
    const buf = A.createBuffer(1, A.sampleRate * 0.07, A.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (A.sampleRate * 0.016));
    const src = A.createBufferSource(); src.buffer = buf;
    const filter = A.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1100; filter.Q.value = 1.2;
    const g = A.createGain(); g.gain.value = 0.035;
    src.connect(filter); filter.connect(g); g.connect(A.destination); src.start(now);
  }
}

/* ---------- risveglio ---------- */
const $l1 = $('#l1'), $l2 = $('#l2'), $sub = $('#sub'),
      LINES = [[1.8, 'Silenzio…'], [4.2, 'Dove… sono?'], [7.6, 'Non ricordo come sono arrivato qui.']];
function runIntro(dt, want) {
  intro.t += dt; const u = intro.t, e = (a, b) => smooth(a, b, u);
  const o = u < .8 ? 0 : u < 2.2 ? .35 * e(.8, 2.2) : u < 3 ? .35 - .3 * e(2.2, 3) : .05 + .95 * e(3, 5.5);
  $l1.style.height = $l2.style.height = (1 - o) * 50 + '%';
  P.pitch = 1.1 - 1.15 * e(5, 8.5); P.yaw = P.yaw0 + .9 * (1 - e(4.5, 8));
  const lie = height(P.x, P.z) + .3; P.eye = lie + (want - lie) * e(7, 10.5);
  let tx = ''; for (const [t0, s] of LINES) if (u >= t0 && u < t0 + 2.6) tx = s;
  if ($sub.textContent !== tx) $sub.textContent = tx;
  if (u > 10.8) {
    intro.on = false; document.body.classList.add('play');
    $l1.remove(); $l2.remove(); $sub.textContent = '';
  }
}
let started = false;
$('#go').addEventListener('click', e => {
  if (started) return; started = true; e.target.blur();
  const st = $('#start'); st.inert = true; setTimeout(() => st.remove(), 3000);
  document.body.classList.add('go'); P.yaw0 = P.yaw; P.pitch = 1.1; intro.on = true; intro.t = 0;
  startAudio();
});

/* ---------- il portale dimensionale ---------- */
const spawn = SP;
const portal = new T.Group();
portal.position.set(PX, PY, PZ);
portal.rotation.y = Math.atan2(spawn.x - PX, spawn.z - PZ);
scene.add(portal);

const stone = new T.MeshStandardMaterial({ map: rockTex, color: 0x9a9fb0, roughness: .88 });
const runeMat = new T.MeshStandardMaterial({ color: 0x221a40, emissive: 0x8f7bff, emissiveIntensity: .25 });
const PR = 3.1, CY = PR + .3;
const pbase = new T.Mesh(new T.CylinderGeometry(6, 6.6, .45, 32), stone); pbase.position.y = -.14;
const ring = new T.Mesh(new T.TorusGeometry(PR, .42, 16, 56), stone); ring.position.y = CY;
portal.add(pbase, ring);

for (let i = 0; i < 14; i++) {
  const a = i / 14 * 6.283, r = new T.Mesh(new T.BoxGeometry(.5, .12, .25), runeMat);
  r.position.set(Math.cos(a) * PR, CY + Math.sin(a) * PR, .42); r.rotation.z = a; portal.add(r);
}

const GLSL_N = 'float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}';
const FIN = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const addMat = (vs, fs) => new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, act: { value: 0 } }, vertexShader: vs, fragmentShader: fs });

const swirl = new T.Mesh(new T.CircleGeometry(PR - .4, 48), addMat(
  'varying vec2 v; void main(){ v=position.xy/2.7; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  `uniform float t,act; varying vec2 v; ${GLSL_N}
void main(){
  float r=length(v), a=atan(v.y,v.x), sw=sin(a*4.+r*12.-t*2.2+ns(v*3.+t*.2)*4.)*.5+.5, s2=sin(a*7.-r*20.+t*3.)*.5+.5;
  vec3 c=mix(vec3(.25,.12,.8),vec3(.35,.8,1.),sw*(1.-r*.6))+vec3(1.)*pow(1.-r,3.)*1.6;
  c*=.55+.45*s2; float e=smoothstep(1.,.85,r);
  gl_FragColor=vec4(c,e*act*(.55+.45*sw)+e*.05);
${FIN}
}`
));
swirl.position.y = CY; portal.add(swirl);

const beam = new T.Mesh(new T.CylinderGeometry(1.3, 1.3, 140, 16, 1, true), addMat(
  'varying float vy; void main(){ vy=(position.y+70.)/140.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  `uniform float act; varying float vy; void main(){
  float a=pow(1.-vy,1.5)*(.3+act*.5)*smoothstep(.02,.14,vy);
  gl_FragColor=vec4(vec3(.5,.45,1.)*a,a);
${FIN}
}`
));
beam.position.y = CY + 70; portal.add(beam);

const pLight = new T.PointLight(0x8a7cff, 0, 60, 1.5);
pLight.position.set(0, CY, 1.5); portal.add(pLight);

const PN = 150, pPos = new Float32Array(PN * 3), pSeed = Array.from({ length: PN }, () => [R() * 6.283, PR - .5 + R() * 1.0, .15 + R() * .5, R() * 2 - 1]);
const parts = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pPos, 3)), new T.PointsMaterial({ size: .14, color: 0xcfc6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
parts.frustumCulled = false; parts.position.y = CY; portal.add(parts);

// Collisioni struttura del portale (i montanti laterali e perimetro)
const pAngle = portal.rotation.y;
const cosA = Math.cos(pAngle), sinA = Math.sin(pAngle);
colliders.push({ x: PX + cosA * (PR + 0.3), z: PZ - sinA * (PR + 0.3), r: 0.8, type: 'portal_pillar' });
colliders.push({ x: PX - cosA * (PR + 0.3), z: PZ + sinA * (PR + 0.3), r: 0.8, type: 'portal_pillar' });

/* ---------- oggetti di scena con interazione ed esame ---------- */
const mat = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: .8, ...o }),
      bx = (w, h, d, c, x, y, z, o) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c, o)); m.position.set(x, y, z); return m; },
      grp = (...a) => { const g = new T.Group(); g.add(...a); return g; };

const img = f => `<img src="foto/${f}" onerror="this.outerHTML='<div class=ph>Metti qui la tua foto:<br>foto/${f}</div>'">`;
const items = []; let near = null, found = 0, act = 0, ended = false;

// Piedistallo per sollevare gli oggetti dal terreno
function makePedestal() {
  const p = new T.Mesh(new T.CylinderGeometry(0.38, 0.46, 0.22, 10), new T.MeshStandardMaterial({ map: rockTex, color: 0x7a746c, roughness: 0.9 }));
  p.position.y = 0.11; p.castShadow = true; return p;
}

function polaroid(url, label) {
  const pm = new T.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: .35, roughness: .6 }),
        set = tx => { tx.colorSpace = T.SRGBColorSpace; pm.map = pm.emissiveMap = tx; pm.needsUpdate = true; };
  set(cv(128, 128, (g, w, h) => {
    g.fillStyle = '#6b7488'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d6dcec'; g.font = '15px Georgia'; g.textAlign = 'center';
    g.fillText(label, 64, 62); g.fillText('(foto)', 64, 82);
  }));
  new T.TextureLoader().load(url, set, undefined, () => {});
  const ph = new T.Mesh(new T.PlaneGeometry(.24, .24), pm);
  ph.rotation.x = -Math.PI / 2; ph.position.set(0, .235, -.02);
  const card = bx(.3, .012, .36, 0xf2efe6, 0, .225, 0, { emissive: 0x555555 });
  return grp(makePedestal(), card, ph);
}

function addItem(x, z, mesh, title, html, colRadius = 0.55) {
  const y = height(x, z);
  mesh.position.set(x, y, z);
  mesh.rotation.y = R() * 6.283;
  mesh.traverse(m => { if (m.isMesh) m.castShadow = true; });

  // Segnale luminoso tenue sopra l'oggetto per individuarlo chiaramente
  const beacon = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), new T.MeshBasicMaterial({ color: 0xffec99, transparent: true, opacity: 0.75 }));
  beacon.position.y = 1.05;
  mesh.add(beacon);

  scene.add(mesh);
  items.push({ x, z, title, html, seen: false, beacon });
  colliders.push({ x, z, r: colRadius, type: 'prop' });
}

const at = (s, k) => {
  const f = s * 48, i = Math.min(47, Math.floor(f)), u = f - i,
        [ax, az] = PATH[i], [qx, qz] = PATH[i + 1], tx = qx - ax, tz = qz - az, l = Math.hypot(tx, tz);
  return [ax + tx * u - tz / l * k, az + tz * u + tx / l * k];
};

addItem(...at(.012, 2.2), polaroid('foto/classe1.jpg', 'La mia classe'), 'Foto di classe', `${img('classe1.jpg')}<p>Siete tutti lì, sorridenti, davanti all'ITIS Matese. Sul retro, a penna: «Non dimenticare da dove sei partito.»</p>`);

{
  const bagMesh = grp(bx(.42, .52, .2, 0x24407a, 0, .26, 0), bx(.34, .2, .06, 0x1a2f5c, 0, .2, .13), bx(.06, .5, .02, 0x111111, .15, .26, -.11), bx(.06, .5, .02, 0x111111, -.15, .26, -.11));
  bagMesh.position.y = 0.2; bagMesh.rotation.z = 0.4;
  const bagGroup = grp(makePedestal(), bagMesh);
  addItem(...at(.10, -3), bagGroup, 'Lo zaino', `<p>Dentro: un quaderno di Informatica, un cavo USB e la <b>Divina Commedia</b> con un segnalibro al primo canto.</p><p><i>«Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura…»</i></p><p>Qualcuno ha sottolineato la parola <b>oscura</b>.</p>`);
}

{
  const diaryGroup = grp(makePedestal(), bx(.28, .05, .38, 0x5a3a1e, 0, .24, 0), bx(.24, .03, .34, 0xe8dcc0, .01, .28, 0));
  addItem(...at(.26, 3.5), diaryGroup, 'Pagina di diario', `<p><i>«Giorno ?. Il portale non è uno solo. Ognuno porta in un universo diverso, e in ognuno c'è una porta per andare avanti. Il primo è buio e pieno di fuoco: un posto che conosco dai libri di scuola.»</i></p>`);
}

{
  const scr = new T.Mesh(new T.PlaneGeometry(.5, .32), new T.MeshBasicMaterial({
    map: cv(256, 160, (g, w, h) => {
      g.fillStyle = '#04101e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#5dffa8'; g.font = '13px monospace';
      ["universi = [", "  'INFERNO',", "  '???', '???' ]", "", "while (vivo) {", "  portale.apri();", "  universo++; }"].forEach((t, i) => g.fillText(t, 10, 22 + i * 19));
    })
  }));
  scr.position.set(0, .44, -.2); scr.rotation.x = -.25;
  const desk = grp(makePedestal(), bx(.52, .03, .36, 0x2a2d35, 0, .24, 0), bx(.52, .34, .02, 0x2a2d35, 0, .42, -.2), scr);
  addItem(...at(.45, -2.5), desk, 'Un portatile ancora acceso', `<p>Sullo schermo, un programma in esecuzione: una lista di universi. Solo il primo è leggibile: <b>INFERNO</b>. Gli altri sono ancora «???».</p><p>Il ciclo non si ferma mai: <code>universo++</code>.</p>`, 0.65);
}

{
  const b = grp(new T.Mesh(new T.CylinderGeometry(.06, .06, .3, 12), mat(0x9fd8c8, { transparent: true, opacity: .5, roughness: .1 })), bx(.03, .22, .03, 0xe8dcc0, 0, 0, 0));
  b.children.forEach(c => c.rotation.z = Math.PI / 2);
  b.children[0].position.y = .28; b.children[1].position.y = .28;
  const bottleGroup = grp(makePedestal(), b);
  addItem(...at(.62, 3), bottleGroup, 'Messaggio in bottiglia', `<p><i>«Se leggi questo, sei sveglio. Cerca una guida: un poeta ha già percorso quella strada e ti aspetta. Non fidarti di chi ha tre teste.»</i></p>`);
}

addItem(...at(.8, -3), polaroid('foto/classe2.jpg', 'Il laboratorio'), 'Il laboratorio di informatica', `${img('classe2.jpg')}<p>Il laboratorio di informatica. Sulla lavagna, dietro, qualcuno ha scritto: <i>«Per ogni porta chiusa c'è un enigma.»</i></p>`);

{
  const sg = cv(256, 96, (g, w, h) => {
    g.fillStyle = '#4a3320'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9c9a0'; g.font = 'bold 19px Georgia'; g.textAlign = 'center';
    g.fillText('LASCIATE OGNE SPERANZA,', 128, 40); g.fillText("VOI CH'INTRATE", 128, 68);
  }), board = new T.Mesh(new T.PlaneGeometry(1.7, .64), new T.MeshStandardMaterial({ map: sg }));
  board.position.set(0, 1.7, .05);
  const sign = grp(bx(.14, 2.1, .14, 0x3a2916, 0, 1.05, 0), bx(1.8, .72, .08, 0x2c1f10, 0, 1.7, 0), board);
  const [sx, sz] = at(.955, -4);
  addItem(sx, sz, sign, 'Il cartello', `<p><b>«Lasciate ogne speranza, voi ch'intrate.»</b></p><p>È la scritta sulla porta dell'Inferno (Dante, <i>Inferno</i>, canto III). Il portale è qui davanti.</p>`, 0.85);
  sign.rotation.y = portal.rotation.y;
}

$('#count').textContent = `OGGETTI  0 / ${items.length}`;
const $pr = $('#prompt'), $pn = $('#panel'), $fl = $('#flash'), $en = $('#end');

addEventListener('keydown', e => {
  if (e.code === 'KeyE' || (ui.open && e.code === 'Escape' && !ended)) {
    if ($pn.classList.contains('on')) {
      $pn.classList.remove('on'); ui.open = false;
    } else if (near && e.code === 'KeyE' && !intro.on) {
      ui.open = true;
      $pn.innerHTML = `<h2>${near.title}</h2>${near.html}<p class="cl">[ E ] CHIUDI</p>`;
      $pn.classList.add('on');
      if (!near.seen) {
        near.seen = true;
        $('#count').textContent = `OGGETTI  ${++found} / ${items.length}`;
      }
    }
  }
});

$('#back').addEventListener('click', e => {
  e.target.blur();
  const ddx = PX - spawn.x, ddz = PZ - spawn.z, dl = Math.hypot(ddx, ddz);
  const k = 8 / dl;
  P.x = PX - ddx * k; P.z = PZ - ddz * k;
  P.yaw = Math.atan2(ddx, ddz) + Math.PI;
  $en.classList.remove('on'); $fl.classList.remove('on');
  ui.open = false; ended = false;
});

function updateWorld(dt, t) {
  const d = Math.hypot(P.x - PX, P.z - PZ);
  act += ((d < 32 ? 1 : 0) - act) * Math.min(1, dt * 1.4);
  swirl.material.uniforms.t.value = t;
  swirl.material.uniforms.act.value = beam.material.uniforms.act.value = act;
  pLight.intensity = act * 70;
  runeMat.emissiveIntensity = .25 + act * 2.2;
  parts.material.opacity = act;

  for (let i = 0; i < PN; i++) {
    const q = pSeed[i]; q[0] += dt * q[2];
    pPos[i * 3] = Math.cos(q[0]) * q[1];
    pPos[i * 3 + 1] = Math.sin(q[0]) * q[1];
    pPos[i * 3 + 2] = Math.sin(t * .7 + i) * .35 * q[3];
  }
  parts.geometry.attributes.position.needsUpdate = true;

  // Animazione particelle magiche sospese (motes)
  for (let i = 0; i < MOTE_COUNT; i++) {
    const m = moteSeeds[i];
    m.ph += dt * m.sp;
    motePos[i * 3] = m.x + Math.sin(m.ph) * m.rad;
    motePos[i * 3 + 1] = m.y0 + Math.sin(m.ph * 1.5 + i) * 0.45;
    motePos[i * 3 + 2] = m.z + Math.cos(m.ph) * m.rad;
  }
  motesGeo.attributes.position.needsUpdate = true;

  // Pulsazione delicata del beacon sopra gli oggetti
  for (let i = 0; i < items.length; i++) {
    const bc = items[i].beacon;
    if (bc) {
      bc.position.y = 1.05 + Math.sin(t * 3.0 + i) * 0.08;
      bc.material.opacity = items[i].seen ? 0.35 : 0.65 + Math.sin(t * 4.0 + i) * 0.25;
    }
  }

  if (ISOLA.audio && ISOLA.audio.hum) ISOLA.audio.hum.gain.value = act * .05;

  if (!ended && act > .85 && d < 1.7 && !intro.on) {
    ended = true; ui.open = true;
    $fl.classList.add('on');
    setTimeout(() => $en.classList.add('on'), 1300);
    if (ISOLA.onPortal) ISOLA.onPortal();
  }

  near = null;
  if (!intro.on && !ui.open) {
    let best = 2.8;
    for (const it of items) {
      const k = Math.hypot(P.x - it.x, P.z - it.z);
      if (k < best) { best = k; near = it; }
    }
  }
  $pr.classList.toggle('on', !!near);
}

/* ---------- loop di gioco ---------- */
const clock = new T.Clock(); let t = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(.05, clock.getDelta()); t += dt;

  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.y;
  const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
  const l = intro.on || ui.open ? 0 : Math.hypot(f, s);

  if (l > .05) {
    const g0 = height(P.x, P.z);
    const isRunning = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const sp = (isRunning ? 4.8 : 2.4) * (g0 < -.1 ? .55 : 1) * Math.min(1, l) / l;
    const moveX = (-Math.sin(P.yaw) * f + Math.cos(P.yaw) * s) * sp * dt;
    const moveZ = (-Math.cos(P.yaw) * f - Math.sin(P.yaw) * s) * sp * dt;

    // Movimento con collisioni fisiche contro tutti gli ostacoli
    const [nx, nz] = movePlayerWithCollision(P.x, P.z, moveX, moveZ);
    P.x = nx; P.z = nz;

    // Frequenza e suono dei passi
    const oldPh = P.ph;
    P.ph += dt * sp * 2.8;
    if (P.jy === 0 && Math.floor(P.ph / Math.PI) !== Math.floor(oldPh / Math.PI)) {
      if (g0 < 0.1) playFootstep('water');
      else if (Math.hypot(P.x - PX, P.z - PZ) < 8.5 || pathDist(P.x, P.z) < 1.0) playFootstep('stone');
      else if (g0 < 1.4) playFootstep('sand');
      else playFootstep('grass');
    }
  }

  const want = Math.max(height(P.x, P.z), -.9) + 1.65 + (l > .05 ? Math.sin(P.ph) * .035 : 0);
  if (intro.on) runIntro(dt, want);
  else P.eye += (want - P.eye) * Math.min(1, dt * 10);

  // Fisica salto
  P.jv -= 12 * dt; P.jy += P.jv * dt;
  if (P.jy < 0) { P.jy = 0; P.jv = 0; }

  camera.position.set(P.x, P.eye + P.jy, P.z);
  camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');

  sky.position.copy(camera.position);
  sky.material.uniforms.t.value = t;
  waterMat.uniforms.t.value = t;

  sun.position.set(P.x, 0, P.z).addScaledVector(SUN, 90);
  sun.target.position.set(P.x, 0, P.z);

  updateWorld(dt, t);
  renderer.render(scene, camera);
});

window.ISOLA = { T, scene, camera, renderer, height, player: P, intro, items, portalPos: [PX, PY, PZ], R_ISLE, colliders };
setTimeout(() => { document.body.classList.add('ready'); $('#status').remove(); }, 350);
