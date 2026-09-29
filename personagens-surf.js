/*
 * Nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Turma do Alex (grupo interno 'surf') — corredores cartoon: Alex (ex-Léo), Duda, Bento e Nina Neon.
// Estilo "boneco de vinil" das artes de referência: cabeça grande (~1/3 da altura), olhos grandes
// com íris colorida, mãos de luva e tênis enormes. Tudo procedural (kit em personagens-base.js);
// peças da mesma cor fundidas numa geometria só → poucos draw calls no celular.
//
// criaCorredor(P) — campos de P (cores em hexa numérico):
//   perfil  'leo' | 'duda' | 'bento' | 'nina'  (sem perfil: deduz pelo nome / neon)
//   casaco  jaqueta/moletom/macacão · calca  bermuda ou calça · bone  boné (Alex) / neon ciano (Nina)
//   tenis   cabedal do tênis · pele · cabelo · mochila  cor de destaque (rosa da Nina)
//   olhos   (opcional) cor da íris
// Retorna { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama }
// (o personagem olha para -z; bracoD/pernaD ficam em +x).
import * as THREE from 'three';
import {
  junta, malha, torno, tubo, extruda, formaAba, retRedondo, escurece, clareia,
  tecido, peleMat, cabeloMat, acende, criaCabeca, geoMao, geoTenis, criaPranchaJato,
} from './personagens-base.js?v=1.0.6';

function perfilDe(P) {
  if (P.perfil) return P.perfil;
  if (P.neon) return 'nina';
  const n = (P.nome || '').toLowerCase();
  if (n.includes('duda')) return 'duda';
  if (n.includes('bento')) return 'bento';
  if (n.includes('nina')) return 'nina';
  return 'leo';
}
const IRIS = { leo: 0x5a2e12, duda: 0x4e2c14, bento: 0x1f9a3a, nina: 0x14c4c8 };

// ================= CORREDOR =================
export function criaCorredor(P) {
  const perfil = perfilDe(P);
  const leo = perfil === 'leo', duda = perfil === 'duda', bento = perfil === 'bento', nina = perfil === 'nina';
  const root = new THREE.Group();
  const corpo = new THREE.Group(); corpo.position.y = 0.95; root.add(corpo);

  // ---- materiais ----
  const mCasaco = tecido(P.casaco, 0.6);
  const mDet = tecido(nina ? P.bone : escurece(P.casaco, 0.8), 0.6);      // costuras, punhos, barra (neon na Nina)
  const mCalca = tecido(P.calca, 0.62);
  const mPele = peleMat(P.pele);
  const mCabelo = cabeloMat(P.cabelo);
  const mSobr = tecido(nina ? 0x2a1622 : escurece(P.cabelo, 0.7), 0.7);
  const mTenis = tecido(P.tenis, 0.5);
  const mSola = tecido(nina ? P.bone : 0xf1e6cf, 0.55);
  const mRosa = tecido(P.mochila, 0.5);                                    // destaques (Nina)
  if (leo) mCasaco.side = THREE.DoubleSide;                                 // jaqueta aberta
  if (nina) {
    acende(mDet, P.bone, 1.3);
    acende(mSola, P.bone, 0.6);
    acende(mRosa, P.mochila, 0.8);
    mCabelo.emissive = new THREE.Color(P.cabelo); mCabelo.emissiveIntensity = 0.18;
  }

  // =============== TRONCO ===============
  const tronco = new THREE.Group(); corpo.add(tronco);
  const EZ = 0.7;
  const L = nina ? 0.93 : 1;   // Nina: roupa justa
  const PERFIL = [
    [0, -0.13], [0.255 * L, -0.13], [0.27 * L, -0.09], [0.262 * L, 0.08], [0.28 * L, 0.28], [0.3 * L, 0.43],
    [0.295 * L, 0.52], [0.25 * L, 0.59], [0.15, 0.635], [0, 0.645],
  ];
  const rAt = y => {
    for (let i = 1; i < PERFIL.length; i++) {
      const [r0, y0] = PERFIL[i - 1], [r1, y1] = PERFIL[i];
      if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y1 > y0 ? (y - y0) / (y1 - y0) : 0);
    }
    return 0.26;
  };
  const fz = (x, y, off = 0) => { const r = rAt(y) + off; return -EZ * r * Math.sqrt(Math.max(0, 1 - (x / r) ** 2)); };
  const bz = (x, y, off = 0) => -fz(x, y, off); // costas
  const pts = PERFIL.map(([r, y]) => new THREE.Vector2(r, y));
  const casaco = [], det = [];
  if (leo) {
    // camiseta por baixo + jaqueta aberta na frente (lathe com abertura)
    const cam = torno(PERFIL.map(([r, y]) => [r * 0.97, y]), 22, EZ);
    const gap = 0.42;
    const jaq = new THREE.LatheGeometry(pts, 24, Math.PI + gap, Math.PI * 2 - gap * 2); jaq.scale(1.02, 1, EZ * 1.02);
    casaco.push([jaq, {}]);
    det.push([cam, {}]);
    // bordas grossas da jaqueta aberta
    for (const sx of [-1, 1]) {
      const x = sx * Math.sin(gap) * 0.27, x2 = sx * Math.sin(gap) * 0.29;
      casaco.push([tubo([x, -0.1, fz(x, -0.1, 0.012)], [x2, 0.3, fz(x2, 0.3, 0.004)], 0.02), {}]);
      casaco.push([tubo([x2, 0.3, fz(x2, 0.3, 0.012)], [sx * 0.15, 0.58, fz(sx * 0.15, 0.58, 0.01)], 0.022), {}]);
    }
  } else {
    casaco.push([torno(PERFIL, 24, EZ), {}]);
  }
  // barra ribada embaixo
  if (!nina) casaco.push([new THREE.TorusGeometry(0.262 * L, 0.035, 8, 26), { p: [0, -0.1, 0], r: [Math.PI / 2, 0, 0], s: [1, EZ, 1.2] }]);
  if (!nina && !leo) det.push([new THREE.TorusGeometry(0.262 * L, 0.012, 5, 26), { p: [0, -0.06, 0], r: [Math.PI / 2, 0, 0], s: [1.03, EZ * 1.03, 1] }]);
  if (leo || bento) {
    // capuz caído nas costas + gola
    casaco.push([new THREE.TorusGeometry(0.16, 0.07, 10, 22), { p: [0, 0.62, 0.04], r: [Math.PI / 2 - 0.35, 0, 0], s: [1.05, 0.95, 1] }]);
    casaco.push([new THREE.SphereGeometry(0.17, 16, 12), { p: [0, 0.55, 0.19], s: [1.1, 0.95, 0.55], r: [-0.3, 0, 0] }]);
  }
  if (bento) {
    // bolso canguru + cordões
    const b = new THREE.Shape();
    b.moveTo(-0.19, 0); b.lineTo(0.19, 0); b.lineTo(0.13, 0.17); b.lineTo(-0.13, 0.17); b.closePath();
    det.push([extruda(b, 0.012, 0.012), { p: [0, 0.1, fz(0, 0.1, 0.012)], r: [-0.05, 0, 0] }]);
    det.push([tubo([-0.06, 0.6, fz(-0.06, 0.6, 0.01)], [-0.065, 0.42, fz(-0.065, 0.42, 0.012)], 0.011, 5), {}]);
    det.push([tubo([0.06, 0.6, fz(0.06, 0.6, 0.01)], [0.065, 0.44, fz(0.065, 0.44, 0.012)], 0.011, 5), {}]);
  }
  if (duda) {
    // gola alta, zíper central e bolsos-faca
    casaco.push([torno([[0.2, 0.56], [0.2, 0.66], [0.175, 0.74], [0.155, 0.745], [0.165, 0.66], [0.17, 0.58]], 20, 0.86), {}]);
    det.push([tubo([0, -0.1, fz(0, -0.1, 0.008)], [0, 0.3, fz(0, 0.3, 0.008)], 0.009, 5), {}]);
    det.push([tubo([0, 0.3, fz(0, 0.3, 0.008)], [0, 0.62, fz(0, 0.58, 0.02) - 0.02], 0.009, 5), {}]);
    det.push([new THREE.BoxGeometry(0.018, 0.045, 0.012), { p: [0.018, 0.5, fz(0, 0.5, 0.02)] }]);
    for (const sx of [-1, 1]) det.push([tubo([sx * 0.13, 0.02, fz(sx * 0.13, 0.02, 0.006)], [sx * 0.17, 0.12, fz(sx * 0.17, 0.12, 0.006)], 0.008, 5), {}]);
    // gomos de jaqueta bufante
    for (const y of [0.18, 0.38]) det.push([new THREE.TorusGeometry(rAt(y) * 1.005, 0.006, 4, 30), { p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: [1, EZ * 1.005, 1] }]);
  }
  if (nina) {
    // linhas neon: gola, "V" no peito, cintura, costas
    det.push([new THREE.TorusGeometry(0.155, 0.02, 6, 20), { p: [0, 0.63, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] }]);
    det.push([new THREE.TorusGeometry(rAt(0.02) + 0.006, 0.016, 5, 30), { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], s: [1, EZ, 1] }]);
    const lin = (a, b, off = 0.012) => det.push([tubo([a[0], a[1], fz(a[0], a[1], off)], [b[0], b[1], fz(b[0], b[1], off)], 0.013, 5), {}]);
    lin([-0.2, 0.42], [-0.08, 0.34]); lin([-0.08, 0.34], [0, 0.4]); lin([0.2, 0.42], [0.08, 0.34]); lin([0.08, 0.34], [0, 0.4]);
    lin([0.1, 0.6], [0.12, 0.05]); lin([-0.24, 0.5], [-0.25, 0.05]); lin([0.24, 0.5], [0.25, 0.05]);
    const linC = (a, b) => det.push([tubo([a[0], a[1], bz(a[0], a[1], 0.012)], [b[0], b[1], bz(b[0], b[1], 0.012)], 0.013, 5), {}]);
    linC([-0.2, 0.44], [0, 0.38]); linC([0, 0.38], [0.2, 0.44]);
  }
  tronco.add(malha(junta(casaco), mCasaco));
  if (det.length) tronco.add(malha(junta(det), leo ? tecido(clareia(P.casaco, 0.12), 0.6) : mDet));
  if (bento) {
    // fones de ouvido pretos no pescoço
    const mFone = tecido(0x1a1a1e, 0.35);
    tronco.add(malha(junta([
      [new THREE.TorusGeometry(0.19, 0.025, 6, 22, Math.PI), { p: [0, 0.66, 0.02], r: [Math.PI / 2 - 0.15, 0, Math.PI] }],
      [new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16), { p: [-0.18, 0.6, -0.1], r: [0, 0, Math.PI / 2 - 0.35] }],
      [new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16), { p: [0.18, 0.6, -0.1], r: [0, 0, -Math.PI / 2 + 0.35] }],
      [new THREE.TorusGeometry(0.07, 0.022, 6, 16), { p: [-0.21, 0.61, -0.1], r: [0, Math.PI / 2, 0] }],
      [new THREE.TorusGeometry(0.07, 0.022, 6, 16), { p: [0.21, 0.61, -0.1], r: [0, Math.PI / 2, 0] }],
    ]), mFone));
  }

  // =============== CABEÇA ===============
  const r = 0.35, cy = 0.4;
  const cabeca = new THREE.Group(); cabeca.position.y = 0.56; tronco.add(cabeca);
  const H = criaCabeca({
    r, cy, pele: mPele, sobr: mSobr, iris: P.olhos ?? IRIS[perfil],
    olho: duda || nina ? 1.08 : 1, palp: duda || nina ? 0.26 : 0.3, sobrEsp: duda || nina ? 0.85 : 1.1,
    sobrAng: bento ? -0.1 : -0.3, nariz: 0.95, queixo: duda || nina ? 0.95 : 1,
  });
  cabeca.add(H.g);
  const cab = [], sobrP = [];
  const capa = (thetaLen, tilt, esc = 1.04) =>
    [new THREE.SphereGeometry(r * esc, 22, 12, 0, Math.PI * 2, 0, Math.PI * thetaLen), { p: [0, cy, 0], r: [tilt, 0, 0], s: [1, 1, 0.97] }];
  if (leo) {
    // cabelo curto aparecendo dos lados e atrás; boné virado pra trás
    cab.push(capa(0.6, 0.75, 1.03));
    for (const sx of [-1, 1]) cab.push([new THREE.SphereGeometry(r * 0.2, 10, 8), { p: [sx * r * 0.9, cy - r * 0.02, r * 0.15], s: [0.5, 1.1, 1] }]);
    cab.push([new THREE.SphereGeometry(r * 0.22, 12, 8), { p: [0, cy + r * 0.55, -r * 0.8], s: [1.2, 0.7, 0.6] }]); // topete na abertura do boné
    const mBone = tecido(P.bone, 0.5);
    cabeca.add(malha(junta([
      [new THREE.SphereGeometry(r * 1.08, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.46), { p: [0, cy + r * 0.28, 0], r: [-0.15, 0, 0], s: [1, 0.86, 0.99] }],
      [extruda(formaAba(r * 0.62, r * 0.55), 0.012, 0.012, false), { p: [0, cy + r * 0.3, r * 0.97], r: [Math.PI / 2 - 0.3, 0, 0] }],
      [new THREE.SphereGeometry(r * 0.08, 10, 6), { p: [0, cy + r * 1.2, 0], s: [1, 0.6, 1] }],
      [new THREE.TorusGeometry(r * 1.06, r * 0.045, 6, 32), { p: [0, cy + r * 0.34, -r * 0.03], r: [Math.PI / 2 - 0.15, 0, 0] }],
      // abertura da alça ajustável (frente), mostrando o topete
      [new THREE.TorusGeometry(r * 0.24, r * 0.045, 6, 14, Math.PI), { p: [0, cy + r * 0.46, -r * 0.93], r: [0.35, 0, 0] }],
    ]), mBone));
  } else if (bento) {
    // cachos: bolinhas espalhadas sobre o topo, laterais e nuca
    cab.push(capa(0.58, 0.78, 1.02));
    const n = 46;
    for (let i = 0; i < n; i++) {
      const t = i / n, phi = Math.acos(1 - t * 1.25), th = i * 2.39996;
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      if (z < -0.35 && y < 0.55) continue; // não cobre a testa
      const rr = r * (0.22 + ((i * 7) % 5) * 0.012);
      cab.push([new THREE.SphereGeometry(rr, 9, 7), { p: [x * r * 1.02, cy + r * 0.1 + y * r * 1.0, z * r * 1.0 + r * 0.03] }]);
    }
  } else {
    // Duda / Nina: cabelo liso preso, franja lateral e rabo de cavalo alto
    cab.push(capa(0.6, 0.8, 1.04));
    for (const sx of [-1, 1]) cab.push([new THREE.SphereGeometry(r * 0.26, 12, 10), { p: [sx * r * 0.82, cy + r * 0.05, r * 0.02], s: [0.45, 1.2, 0.9] }]);
    // franja: mechas em arco caindo na testa
    const mechas = nina ? [[-0.55, 0.7, 0.35], [-0.2, 0.78, 0.3], [0.35, 0.72, 0.32], [0.65, 0.55, 0.3]] : [[-0.5, 0.72, 0.36], [-0.15, 0.8, 0.3], [0.35, 0.74, 0.34]];
    for (const [x, y, s] of mechas) {
      const X = x * r, Y = cy + y * r;
      cab.push([new THREE.SphereGeometry(r * s, 12, 10), { p: [X, Y, H.zf(X, Y) + r * 0.13], s: [1.2, 0.55, 0.7], r: [0.3, 0, -x * 0.9] }]);
    }
    // rabo de cavalo: esferas decrescentes numa curva que sobe, vai pra trás e cai
    const base = [0, cy + r * 1.0, r * 0.35];
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...base), new THREE.Vector3(0, cy + r * 1.35, r * 0.75),
      new THREE.Vector3(0, cy + r * 1.15, r * 1.35), new THREE.Vector3(0, cy + r * 0.45, r * 1.55),
      new THREE.Vector3(0, cy - r * 0.05, r * 1.35),
    ]);
    // tubo afinando (raio varia ao longo da curva) → mecha lisa, sem "gomos"
    const TS = 28, RS = 12, rabo = new THREE.TubeGeometry(curva, TS, 1, RS, false);
    const pos = rabo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= TS; i++) {
      const t = i / TS; curva.getPointAt(t, c);
      const rr = r * (0.26 * (1 - t * 0.8) + 0.025) * (1 + Math.sin(t * Math.PI) * 0.35);
      for (let j = 0; j <= RS; j++) {
        const k = i * (RS + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(rr).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    rabo.computeVertexNormals();
    cab.push([rabo, {}]);
    cab.push([new THREE.SphereGeometry(r * 0.24, 12, 9), { p: base }]);
    cab.push([new THREE.SphereGeometry(r * 0.03, 6, 4), { p: curva.getPointAt(1).toArray() }]);
    sobrP.push([new THREE.TorusGeometry(r * 0.2, r * 0.05, 6, 16), { p: [base[0], base[1] + r * 0.05, base[2] + r * 0.08], r: [0.9, 0, 0] }]);
  }
  cabeca.add(malha(junta(cab), mCabelo));
  if (sobrP.length && !nina) cabeca.add(malha(junta(sobrP), mSobr));
  if (nina) {
    // óculos futuristas na testa: armação rosa + lente ciano brilhando + elástico
    const gy = cy + r * 0.72;
    const zf = x => H.zf(x, gy) - r * 0.09;
    cabeca.add(malha(junta([
      [extruda(retRedondo(r * 1.35, r * 0.46, r * 0.2), r * 0.06, r * 0.04), { p: [0, gy, zf(0) + r * 0.03], r: [-0.45, 0, 0] }],
      [new THREE.TorusGeometry(r * 1.05, r * 0.045, 6, 30), { p: [0, cy + r * 0.25, 0], r: [Math.PI / 2 + 0.45, 0, 0] }],
      ...sobrP,
    ]), mRosa));
    const mLente = new THREE.MeshStandardMaterial({ color: P.bone, roughness: 0.15, metalness: 0.1, emissive: P.bone, emissiveIntensity: 0.9, transparent: true, opacity: 0.92 });
    cabeca.add(malha(extruda(retRedondo(r * 1.12, r * 0.3, r * 0.14), r * 0.05, r * 0.02), mLente,
      { p: [0, gy + r * 0.005, zf(0) - r * 0.02], r: [-0.45, 0, 0] }));
  }

  // =============== BRAÇOS (pivô no ombro, membro pende pra -y) ===============
  const curta = leo; // Alex: manga curta dobrada
  const bf = duda ? 1.12 : L; // Duda: jaqueta bufante
  const gManga = junta([
    ...(curta ? [[new THREE.TorusGeometry(0.105, 0.03, 8, 18), { p: [0, -0.19, 0], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.4] }]] : []),
    [new THREE.SphereGeometry(0.115, 14, 10), { s: [1, 0.9, 1] }],
    [torno(curta
      ? [[0, -0.2], [0.105, -0.2], [0.11, -0.12], [0.115, -0.02], [0.1, 0.04], [0, 0.05]]
      : [[0, -0.36], [0.085 * bf, -0.36], [0.1 * bf, -0.25], [0.108 * bf, -0.1], [0.1, 0.03], [0, 0.05]], 16), {}],
  ]);
  const gPunho = curta ? null : new THREE.CylinderGeometry(0.082, 0.078, 0.07, 16);
  const antebraco = curta ? [[new THREE.CapsuleGeometry(0.068, 0.16, 4, 10), { p: [0, -0.3, 0] }]] : [];
  const gMao = junta([...antebraco, [geoMao(1.12), { p: [0, curta ? -0.4 : -0.38, 0] }]]);
  const braco = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0.49, 0);
    const abre = new THREE.Group(); abre.rotation.z = Math.sign(x) * 0.08; piv.add(abre);
    abre.add(malha(gManga, mCasaco));
    if (gPunho) abre.add(malha(gPunho, mDet, { p: [0, -0.37, 0] }));
    abre.add(malha(gMao, mPele));
    tronco.add(piv); return piv;
  };
  const bracoE = braco(-0.37), bracoD = braco(0.37);

  // =============== PERNAS (pivô no quadril) ===============
  const bermuda = leo || bento;
  const gCalca = bermuda
    ? junta([[torno([[0, -0.46], [0.135, -0.46], [0.14, -0.3], [0.145, -0.1], [0.125, -0.02], [0.08, 0.02], [0, 0.03]], 16), {}],
      [new THREE.TorusGeometry(0.135, 0.025, 6, 18), { p: [0, -0.45, 0], r: [Math.PI / 2, 0, 0] }]])
    : torno([[0, -0.72], [0.095, -0.72], [0.1, -0.55], [0.12, -0.3], [0.135, -0.1], [0.115, -0.02], [0.07, 0.02], [0, 0.03]], 16);
  const gCanela = bermuda ? new THREE.CapsuleGeometry(0.068, 0.2, 4, 10) : null;
  const T = geoTenis(0.9, 1.08);
  const gSola = junta([[T.sola, {}], [T.det, {}]]);
  const gNeonPe = nina ? junta([
    [new THREE.TorusGeometry(0.155 * 1.08, 0.022, 6, 26), { p: [0, -0.9 + 0.1, -0.07 * 1.08], r: [Math.PI / 2, 0, 0], s: [1, 1.62, 1] }],
    [new THREE.TorusGeometry(0.1, 0.018, 6, 18), { p: [0, -0.5, 0], r: [Math.PI / 2, 0, 0] }],
  ]) : null;
  const perna = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0, 0);
    piv.add(malha(gCalca, mCalca));
    if (bermuda) {
      piv.add(malha(gCanela, mPele, { p: [0, -0.6, 0] }));
    }
    piv.add(malha(T.cab, mTenis));
    piv.add(malha(gSola, nina ? mRosa : mSola));
    if (nina) piv.add(malha(gNeonPe, mDet));
    corpo.add(piv); return piv;
  };
  const pernaE = perna(-0.155), pernaD = perna(0.155);

  // ---- prancha flutuante e jato nas costas ----
  const { prancha, jato, chama } = criaPranchaJato(tronco, [0, 0.3, 0.3]);
  root.add(prancha);

  return { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama };
}
