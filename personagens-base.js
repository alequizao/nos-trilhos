/*
 * Nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Nos Trilhos — kit cartoon compartilhado pelos personagens (estilo "vinil 3D"):
// cabeça grande com olhos expressivos, mãos de luva, tênis/sapatos grandes e
// materiais com leve brilho + contorno de luz (fresnel barato via onBeforeCompile).
// Tudo procedural, sem texturas. Peças da mesma cor são fundidas (junta) → poucos draw calls.
import * as THREE from 'three';

// ================= GEOMETRIA =================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

// matriz a partir de {p:[x,y,z], r:[x,y,z], s:[x,y,z]}
export function matriz(t = {}) {
  _p.set(...(t.p || [0, 0, 0]));
  _q.setFromEuler(_e.set(...(t.r || [0, 0, 0])));
  _s.set(...(t.s || [1, 1, 1]));
  return _m.compose(_p, _q, _s);
}

// funde várias geometrias (cada uma com sua transformação) numa só
export function junta(partes) {
  let n = 0;
  const gs = partes.map(([g0, t]) => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    g.applyMatrix4(matriz(t)); n += g.attributes.position.count; return g;
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  for (const [g0] of partes) g0.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
// aplica uma transformação extra (quadro de referência) numa geometria
export function em(g, t) { g.applyMatrix4(matriz(t)); return g; }

// cria um Mesh já posicionado e projetando sombra
export function malha(geo, mat, t = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (t.p) m.position.set(...t.p);
  if (t.r) m.rotation.set(...t.r);
  if (t.s) m.scale.set(...t.s);
  m.castShadow = true;
  return m;
}

// sólido de revolução; pts = [[raio, y], ...] de baixo pra cima
export function torno(pts, seg = 20, escZ = 1) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (escZ !== 1) g.scale(1, 1, escZ);
  return g;
}
// retângulo com cantos arredondados (Shape 2D)
export function retRedondo(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// extrusão com chanfro arredondado, centralizada na origem
export function extruda(shape, prof, bevel, centraliza = true) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: prof, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8,
  });
  if (centraliza) g.center();
  return g;
}
// aba de boné em forma de "D"
export function formaAba(larg, comp) {
  const s = new THREE.Shape();
  s.moveTo(-larg, 0);
  s.bezierCurveTo(-larg, comp * 1.3, larg, comp * 1.3, larg, 0);
  return s;
}
// cápsula entre dois pontos a→b (raio r)
export function tubo(a, b, r, seg = 8) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, L), 3, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
// arco (sorriso/costura): toro parcial centrado, abertura pra cima
export function arco(raio, esp, ang, seg = 14) {
  const g = new THREE.TorusGeometry(raio, esp, 6, seg, ang);
  g.rotateZ(-Math.PI / 2 - ang / 2);
  return g;
}

// ================= MATERIAIS =================
// contorno de luz (rim) fresnel: soma um brilho suave na borda da silhueta.
// Um único programa de shader por tipo de material (cache key fixa).
function comRim(mat, forca = 0.32, cor = '1.0, 0.96, 0.9') {
  mat.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
      totalEmissiveRadiance += vec3(${cor}) * (pow(rimF, 3.0) * ${forca.toFixed(3)});`);
  };
  mat.customProgramCacheKey = () => 'rim' + forca.toFixed(3) + cor;
  return mat;
}
export const escurece = (c, k) => new THREE.Color(c).multiplyScalar(k);
export const clareia = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k);
// tecido: acetinado, como boneco de vinil
export const tecido = (c, r = 0.55) => comRim(new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 }));
// pele: leve sheen + clearcoat sutil
export const peleMat = c => comRim(new THREE.MeshPhysicalMaterial({
  color: c, roughness: 0.5, metalness: 0, sheen: 0.2, sheenRoughness: 0.5,
  sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffd8c0), 0.5), clearcoat: 0.12, clearcoatRoughness: 0.55,
}), 0.28, '1.0, 0.9, 0.8');
// cabelo: fosco com rim mais forte (destaca a silhueta)
export const cabeloMat = c => comRim(new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0 }), 0.4);
// couro/sapato envernizado
export const vernizMat = c => comRim(new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.1 }), 0.35);
export const metal = (c, r = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.75 });
export const brilhoMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false });
export function acende(m, c, k) { m.color.set(c); m.emissive = new THREE.Color(c); m.emissiveIntensity = k; }

// materiais de olho compartilhados (mesma cor em todo mundo → reaproveita programa)
const OLHO_B = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.22 });
const PUPILA = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.2 });
const BRILHO = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BOCA = new THREE.MeshStandardMaterial({ color: 0x4a1210, roughness: 0.6 });
const DENTE = new THREE.MeshStandardMaterial({ color: 0xfbfbf6, roughness: 0.35 });
const irisCache = {};
function irisMat(c) {
  return irisCache[c] || (irisCache[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.2,
    emissive: new THREE.Color(c), emissiveIntensity: 0.18 }));
}

// ================= CABEÇA CARTOON =================
// Monta o crânio + rosto num Group cuja origem é a base do pescoço (encaixa no topo do tronco).
// o: { r (raio do crânio), cy (altura do centro), pele (material), sobr (material das sobrancelhas),
//      iris (cor), olho (tamanho rel. 1), palp (0..1 quanto a pálpebra cobre), sobrAng (+ = bravo),
//      sobrEsp (espessura), sobrY, boca: 'sorriso'|'dentes'|'serio'|'fechado', nariz (rel.),
//      queixo (rel.: alarga a parte de baixo), pescoco (raio), orelha (rel.), semOlhos (óculos escuros) }
// Retorna { g (Group), z(x,y) → z da superfície frontal do rosto (pra colar barba/óculos), r, cy }.
export function criaCabeca(o) {
  const r = o.r ?? 0.36, cy = o.cy ?? 0.38, ESY = 1.0, ESZ = 0.94;
  const g = new THREE.Group();
  const zf = (x, y) => { // superfície frontal (lado -z) do elipsoide do crânio
    const q = 1 - (x / r) ** 2 - ((y - cy) / (r * ESY)) ** 2;
    return -r * ESZ * Math.sqrt(Math.max(0.02, q));
  };
  const Q = o.queixo ?? 1;
  // frente do rosto = o que estiver mais à frente: crânio ou volume da mandíbula
  const JY = cy - r * 0.36, JZ = -r * 0.13, JR = r * 0.78, JS = [1.05 * Q, 0.76, 1.06];
  const zr = (x, y) => {
    const q = 1 - (x / (JR * JS[0])) ** 2 - ((y - JY) / (JR * JS[1])) ** 2;
    return q > 0 ? Math.min(zf(x, y), JZ - JR * JS[2] * Math.sqrt(q)) : zf(x, y);
  };
  const pele = [
    [new THREE.CylinderGeometry(o.pescoco ?? 0.1, (o.pescoco ?? 0.1) * 1.1, 0.24, 12), { p: [0, 0.06, 0.02] }],
    [new THREE.SphereGeometry(r, 30, 22), { p: [0, cy, 0], s: [1, ESY, ESZ] }],
    // bochechas/mandíbula: volume embaixo, cara de boneco
    [new THREE.SphereGeometry(JR, 20, 14), { p: [0, JY, JZ], s: JS }],
  ];
  const orel = new THREE.SphereGeometry(r * 0.2 * (o.orelha ?? 1), 12, 10);
  for (const sx of [-1, 1]) {
    pele.push([orel.clone(), { p: [sx * r * 0.98, cy - r * 0.05, r * 0.05], s: [0.55, 1.05, 0.8], r: [0, sx * 0.4, 0] }]);
    // concha interna da orelha
    pele.push([new THREE.TorusGeometry(r * 0.1 * (o.orelha ?? 1), r * 0.03, 6, 10), { p: [sx * r * 1.05, cy - r * 0.05, r * 0.03], r: [0, sx * Math.PI / 2, 0], s: [1, 1.3, 1] }]);
  }
  orel.dispose();
  // nariz arredondado de desenho
  const nz = o.nariz ?? 1, ny = cy - r * 0.2;
  pele.push([new THREE.SphereGeometry(r * 0.15 * nz, 14, 10), { p: [0, ny, zr(0, ny) - r * 0.07 * nz], s: [1.05, 0.9, 1] }]);
  pele.push([new THREE.SphereGeometry(r * 0.08 * nz, 10, 8), { p: [-r * 0.1 * nz, ny - r * 0.04, zf(0, ny) - r * 0.02] }]);
  pele.push([new THREE.SphereGeometry(r * 0.08 * nz, 10, 8), { p: [r * 0.1 * nz, ny - r * 0.04, zf(0, ny) - r * 0.02] }]);

  // ---- olhos: esclera + íris colorida + pupila + 2 brilhos; pálpebra superior de pele ----
  const re = r * 0.21 * (o.olho ?? 1), ex = r * 0.36, ey = cy + r * 0.06;
  const esclera = [], iris = [], pup = [], luz = [];
  const palp = o.palp ?? 0.3;
  for (const sx of [-1, 1]) {
    const x = sx * ex, a = -Math.asin(x / r) * 0.85;
    const Z = zf(x, ey) + re * 0.35;
    const F = { p: [x, ey, Z], r: [0, a, 0] }; // quadro do olho (olha pra -z local)
    esclera.push([em(new THREE.SphereGeometry(re, 18, 14), { s: [1, 1.22, 0.62] }), F]);
    const ri = re * 0.66;
    iris.push([em(new THREE.SphereGeometry(ri, 16, 12), { p: [sx * -re * 0.06, -re * 0.05, -re * 0.44], s: [1, 1.12, 0.45] }), F]);
    pup.push([em(new THREE.SphereGeometry(ri * 0.52, 12, 10), { p: [sx * -re * 0.06, -re * 0.05, -re * 0.44 - ri * 0.2], s: [1, 1.12, 0.4] }), F]);
    luz.push([em(new THREE.SphereGeometry(re * 0.17, 8, 6), { p: [-re * 0.18, re * 0.22, -re * 0.66] }), F]);
    luz.push([em(new THREE.SphereGeometry(re * 0.08, 6, 4), { p: [re * 0.2, -re * 0.25, -re * 0.62] }), F]);
    if (palp > 0) // pálpebra: calota de pele um pouco maior que a esclera, cobrindo o topo
      pele.push([em(new THREE.SphereGeometry(re * 1.07, 18, 8, 0, Math.PI * 2, 0, Math.PI * palp),
        { s: [1, 1.22, 0.66], r: [-0.25 + (o.palpInc ?? 0), 0, sx * (o.palpGiro ?? 0)] }), F]);
  }
  const mSobr = o.sobr;
  // ---- sobrancelhas grossas (cápsulas curvas) ----
  const sob = [];
  const sa = o.sobrAng ?? 0, se = (o.sobrEsp ?? 1) * r * 0.055, sy = o.sobrY ?? (ey + re * 1.45);
  for (const sx of [-1, 1]) {
    const x0 = sx * ex * 0.45, x1 = sx * ex * 1.45;
    const y0 = sy - sa * r * 0.12, y1 = sy + sa * r * 0.02 + r * 0.03;
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2 + r * 0.04;
    sob.push([tubo([x0, y0, zf(x0, y0) - se * 0.4], [xm, ym, zf(xm, ym) - se * 0.5], se, 6), {}]);
    sob.push([tubo([xm, ym, zf(xm, ym) - se * 0.5], [x1, y1 - r * 0.04, zf(x1, y1) - se * 0.2], se * 0.85, 6), {}]);
  }
  // ---- boca ----
  const by = cy - r * 0.45, bz = zr(0, by) - r * 0.015;
  const bocaT = o.boca ?? 'sorriso';
  const bocaPartes = [], dentes = [];
  if (bocaT === 'dentes') {
    // boca aberta em "D" + fileira de dentes em cima
    const D = new THREE.Shape(); const w = r * 0.3;
    D.moveTo(-w, 0); D.bezierCurveTo(-w * 0.9, -w * 0.9, w * 0.9, -w * 0.9, w, 0); D.quadraticCurveTo(0, w * 0.18, -w, 0);
    const gD = extruda(D, r * 0.04, r * 0.012, false);
    bocaPartes.push([gD, { p: [0, by + r * 0.06, bz + r * 0.035], r: [0.2, Math.PI, 0] }]);
    dentes.push([new THREE.BoxGeometry(w * 1.45, r * 0.07, r * 0.04), { p: [0, by + r * 0.035, bz + r * 0.005], r: [0.2, 0, 0] }]);
    pele.push([arco(r * 0.04, r * 0.018, Math.PI * 0.8, 8), { p: [-w * 1.05, by + r * 0.05, bz + r * 0.03], r: [0, 0.3, 0.6] }]);
    pele.push([arco(r * 0.04, r * 0.018, Math.PI * 0.8, 8), { p: [w * 1.05, by + r * 0.05, bz + r * 0.03], r: [0, -0.3, -0.6] }]);
  } else if (bocaT === 'serio') {
    bocaPartes.push([tubo([-r * 0.16, by + r * 0.02, bz + r * 0.03], [r * 0.16, by + r * 0.02, bz + r * 0.03], r * 0.018, 6), {}]);
  } else {
    // sorriso fechado de lado a lado com cantinhos
    bocaPartes.push([arco(r * 0.24, r * 0.026, Math.PI * 0.62, 16), { p: [0, by + r * 0.2, bz + r * 0.02], r: [0.35, 0, 0], s: [1, 0.9, 1] }]);
  }
  g.add(malha(junta(pele), o.pele));
  if (!o.semOlhos) {
    g.add(malha(junta(esclera), OLHO_B));
    g.add(malha(junta([...pup, ...bocaPartes]), PUPILA));
    g.add(malha(junta(iris), irisMat(o.iris ?? 0x6b3a1a)));
    g.add(malha(junta(luz), BRILHO));
  } else {
    ;[...esclera, ...iris, ...pup, ...luz].forEach(([x]) => x.dispose());
    if (bocaPartes.length) g.add(malha(junta(bocaPartes), PUPILA));
  }
  if (dentes.length) g.add(malha(junta(dentes), DENTE));
  if (mSobr) g.add(malha(junta(sob), mSobr)); else sob.forEach(([x]) => x.dispose());
  return { g, zf, zr, r, cy };
}

// ================= MÃO DE LUVA (dedos simplificados, punho semifechado) =================
// origem no pulso; a mão pende pra -y. k = escala.
export function geoMao(k = 1, aberta = false) {
  const R = 0.085 * k;
  const p = [[new THREE.SphereGeometry(R, 14, 10), { p: [0, -R * 0.9, 0], s: [1.05, 1.0, 0.8] }]];
  const fr = R * 0.34;
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * R * 0.52;
    const L = (i === 0 || i === 3) ? 0.82 : 1;
    if (aberta) p.push([tubo([x, -R * 1.5, 0], [x * 1.1, -R * (1.5 + 0.9 * L), -R * 0.1], fr, 6), {}]);
    else { // dedos dobrados pra frente (punho de corredor)
      p.push([tubo([x, -R * 1.55, 0], [x, -R * (1.55 + 0.55 * L), -R * 0.35], fr, 6), {}]);
      p.push([new THREE.SphereGeometry(fr * 1.05, 8, 6), { p: [x, -R * (1.55 + 0.55 * L), -R * 0.5] }]);
    }
  }
  // polegar
  p.push([tubo([-R * 0.6, -R * 0.9, -R * 0.35], [-R * 0.55, -R * 1.5, -R * 0.75], fr * 1.1, 6), {}]);
  return junta(p);
}

// ================= TÊNIS CARTOON =================
// origem no quadril (topo da perna); o pé fica em y ≈ -alt. Retorna {cabedal, sola, detalhe} geometrias.
export function geoTenis(alt = 0.9, k = 1) {
  const cab = junta([
    [new THREE.SphereGeometry(0.15 * k, 20, 14), { p: [0, -alt + 0.1 * k, -0.07 * k], s: [0.95, 0.72, 1.55] }],
    [new THREE.CylinderGeometry(0.12 * k, 0.14 * k, 0.14 * k, 16), { p: [0, -alt + 0.14 * k, 0.03 * k] }], // cano
    [new THREE.TorusGeometry(0.12 * k, 0.03 * k, 8, 18), { p: [0, -alt + 0.2 * k, 0.03 * k], r: [Math.PI / 2, 0, 0] }], // colarinho acolchoado
  ]);
  const sola = junta([
    [new THREE.CylinderGeometry(0.155 * k, 0.15 * k, 0.07 * k, 22), { p: [0, -alt + 0.035 * k, -0.07 * k], s: [1, 1, 1.62] }],
    [new THREE.TorusGeometry(0.15 * k, 0.03 * k, 6, 26), { p: [0, -alt + 0.06 * k, -0.07 * k], r: [Math.PI / 2, 0, 0], s: [1, 1.62, 1] }],
  ]);
  const det = junta([ // cadarços/tiras em cima + biqueira
    [tubo([-0.07 * k, -alt + 0.2 * k, -0.12 * k], [0.07 * k, -alt + 0.2 * k, -0.12 * k], 0.022 * k), {}],
    [tubo([-0.07 * k, -alt + 0.17 * k, -0.19 * k], [0.07 * k, -alt + 0.17 * k, -0.19 * k], 0.022 * k), {}],
    [new THREE.SphereGeometry(0.1 * k, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, -alt + 0.07 * k, -0.22 * k], s: [1.2, 0.8, 0.85] }],
  ]);
  return { cab, sola, det };
}
// sapato social cartoon (bico redondo, alto), mesmas convenções
export function geoSapato(alt = 0.9, k = 1) {
  const cab = junta([
    [new THREE.SphereGeometry(0.145 * k, 20, 14), { p: [0, -alt + 0.09 * k, -0.08 * k], s: [0.95, 0.68, 1.6] }],
    [new THREE.CylinderGeometry(0.12 * k, 0.135 * k, 0.12 * k, 16), { p: [0, -alt + 0.12 * k, 0.03 * k] }],
  ]);
  const sola = junta([
    [new THREE.CylinderGeometry(0.15 * k, 0.145 * k, 0.045 * k, 22), { p: [0, -alt + 0.022 * k, -0.08 * k], s: [1, 1, 1.66] }],
    [new THREE.BoxGeometry(0.22 * k, 0.05 * k, 0.1 * k), { p: [0, -alt + 0.025 * k, 0.1 * k] }],
  ]);
  const det = junta([
    [tubo([-0.05 * k, -alt + 0.17 * k, -0.12 * k], [0.05 * k, -alt + 0.17 * k, -0.12 * k], 0.01 * k), {}],
    [tubo([-0.05 * k, -alt + 0.155 * k, -0.16 * k], [0.05 * k, -alt + 0.155 * k, -0.16 * k], 0.01 * k), {}],
  ]);
  return { cab, sola, det };
}

// ================= PRANCHA E JATO (iguais em todas as turmas) =================
export function criaPranchaJato(tronco, jatoPos = [0, 0.3, 0.42]) {
  const prancha = new THREE.Group();
  const mPrancha = new THREE.MeshStandardMaterial({ color: 0x19c2ff, roughness: 0.35, metalness: 0.2, emissive: 0x0a4a66, emissiveIntensity: 0.6 });
  prancha.add(malha(extruda(retRedondo(0.72, 1.7, 0.34), 0.04, 0.03), mPrancha, { p: [0, 0.12, 0], r: [-Math.PI / 2, 0, 0] }));
  const mFaixa = new THREE.MeshStandardMaterial({ color: 0xff3d7f, roughness: 0.5, emissive: 0xff3d7f, emissiveIntensity: 0.35 });
  prancha.add(malha(extruda(retRedondo(0.16, 1.3, 0.08), 0.006, 0.006), mFaixa, { p: [0, 0.178, 0], r: [-Math.PI / 2, 0, 0] }));
  const bp = malha(new THREE.ShapeGeometry(retRedondo(0.86, 1.86, 0.4), 12), brilhoMat(0x6ff0ff), { p: [0, 0.05, 0], r: [-Math.PI / 2, 0, 0] });
  bp.material.opacity = 0.55; bp.castShadow = false; prancha.add(bp);
  prancha.visible = false;

  const jato = new THREE.Group(); jato.position.set(...jatoPos);
  const tanque = new THREE.CapsuleGeometry(0.1, 0.36, 6, 14);
  jato.add(malha(junta([[tanque.clone(), { p: [-0.15, 0, 0.12] }], [tanque, { p: [0.15, 0, 0.12] }]]),
    new THREE.MeshStandardMaterial({ color: 0xe8364f, roughness: 0.35, metalness: 0.45 })));
  const partes = [];
  for (const x of [-0.15, 0.15]) {
    partes.push([new THREE.TorusGeometry(0.103, 0.018, 6, 18), { p: [x, 0.12, 0.12], r: [Math.PI / 2, 0, 0] }]);
    partes.push([new THREE.TorusGeometry(0.103, 0.018, 6, 18), { p: [x, -0.12, 0.12], r: [Math.PI / 2, 0, 0] }]);
    partes.push([new THREE.CylinderGeometry(0.06, 0.085, 0.11, 14, 1, true), { p: [x, -0.33, 0.12] }]);
  }
  partes.push([new THREE.CapsuleGeometry(0.03, 0.22, 3, 8), { p: [0, 0.12, 0.12], r: [0, 0, Math.PI / 2] }]);
  jato.add(malha(junta(partes), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.45, metalness: 0.6 })));
  const cone = (r, h) => { const g = new THREE.ConeGeometry(r, h, 12, 1, true); g.rotateX(Math.PI); g.translate(0, -h / 2, 0); return g; };
  const gChama = cone(0.075, 0.6), gNucleo = cone(0.04, 0.34);
  const mChama = brilhoMat(0xff8a1a), mNucleo = brilhoMat(0xfff2b0);
  const chama = malha(gChama, mChama, { p: [-0.15, -0.385, 0.12] }); chama.castShadow = false;
  chama.add(malha(gNucleo, mNucleo));
  const chamaD = malha(gChama, mChama, { p: [0.3, 0, 0] });
  chamaD.add(malha(gNucleo, mNucleo));
  chama.add(chamaD);
  jato.add(chama);
  jato.visible = false; tronco.add(jato);
  return { prancha, jato, chama };
}
