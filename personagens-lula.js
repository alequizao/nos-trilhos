/*
 * Nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Lula nos Trilhos — personagens (Lula cartoon, segurança e cachorro caramelo)
// Estilo "boneco de vinil": cabeça grande (~1/3 da altura), olhos grandes com íris,
// mãos de luva, sapatos grandes. Tudo procedural (kit em personagens-base.js),
// peças da mesma cor fundidas numa geometria só (poucos draw calls).
//
// criaCorredor(P) — campos aceitos em P (cores em hexa numérico):
//   casaco   cor do paletó (ou do macacão, se P.macacao)
//   calca    cor da calça do terno (ou das pernas do macacão)
//   camisa/mochila  cor da camisa social (P.mochila é o nome usado nas SKINS)
//   bone     cor da gravata (ou do capacete, se P.macacao)
//   gravata  (opcional) sobrepõe a cor da gravata; quando existe, ganha listras
//   tenis    cor dos sapatos sociais (ou das botinas, se P.macacao)
//   pele     cor da pele
//   cabelo   cor do cabelo, barba, bigode (sobrancelhas um tom mais escuro)
//   pasta    true → pasta executiva escura na mão esquerda
//   faixa    true → faixa presidencial verde-amarela
//   macacao  true → "Lula Metalúrgico": macacão de operário, capacete, botinas
//   neon     true → detalhes brilhando (lapelas, gravata, camisa, sapatos)
// Retorna { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama }
// (o personagem olha para -z; bracoD/pernaD ficam em +x).
//
// criaVigia() — segurança careca de terno preto, óculos escuros e ponto no ouvido, com o
// cachorro caramelo. Retorna { root, corpo, pE, pD, bE, bD, cao, patas } (bE.ante/bD.ante = antebraço).
import * as THREE from 'three';
import {
  junta, em, malha, torno, retRedondo, extruda, tubo, arco, tecido, peleMat, cabeloMat, vernizMat,
  escurece, clareia, acende, metal, criaCabeca, geoMao, geoSapato, criaPranchaJato,
} from './personagens-base.js?v=1.0.6';

// ================= AJUDANTES LOCAIS =================
// forma 2D a partir de uma lista de pontos [x, y]
function poligono(pts) {
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) s.lineTo(...pts[i]);
  s.closePath();
  return s;
}
// placa fina: polígono extrudado sem centralizar (origem da forma fica no lugar)
const placa = (pts, prof, bev) => extruda(poligono(pts), prof, bev, false);

// placa "colada" numa superfície: fz(x, y) dá o z da superfície; a peça fica
// encostada nela (afastada `off`) e acompanha a curva do peito/barriga
function colado(pts, prof, bev, fz, off = 0) {
  const g0 = placa(pts, prof, bev);
  const src = (g0.index ? g0.toNonIndexed() : g0).attributes.position.array;
  // quebra triângulos grandes (lado > 5 cm) pra peça conseguir dobrar na curva
  const fila = [], out = [], MAX2 = 0.05 * 0.05;
  for (let i = 0; i < src.length; i += 9) fila.push(Array.from(src.slice(i, i + 9)));
  const d2 = (t, i, j) => (t[i] - t[j]) ** 2 + (t[i + 1] - t[j + 1]) ** 2 + (t[i + 2] - t[j + 2]) ** 2;
  while (fila.length) {
    const t = fila.pop();
    const l = [d2(t, 0, 3), d2(t, 3, 6), d2(t, 6, 0)], k = l.indexOf(Math.max(...l));
    if (l[k] <= MAX2) { out.push(...t); continue; }
    const A = k * 3, B = ((k + 1) % 3) * 3, C = ((k + 2) % 3) * 3;
    const v = i => [t[i], t[i + 1], t[i + 2]];
    const m = [0, 1, 2].map(j => (t[A + j] + t[B + j]) / 2);
    fila.push([...v(A), ...m, ...v(C)], [...m, ...v(B), ...v(C)]);
  }
  g0.dispose();
  for (let i = 0; i < out.length; i += 3) out[i + 2] += fz(out[i], out[i + 1]) - off - (prof + bev);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  return g;
}
// z da frente de um tronco feito com torno(perfil, …, ez), com barriga opcional {y, z, r, sx, sz}
function superficieFrente(perfil, ez, b) {
  return (x, y) => {
    let r = perfil[perfil.length - 1][0];
    for (let i = 1; i < perfil.length; i++) {
      const [r0, y0] = perfil[i - 1], [r1, y1] = perfil[i];
      if (y >= y0 && y <= y1) { r = r0 + (r1 - r0) * (y1 > y0 ? (y - y0) / (y1 - y0) : 0); break; }
    }
    r = Math.max(r, 0.12);
    let z = -ez * r * Math.sqrt(Math.max(0, 1 - (x / r) ** 2));
    if (b) {
      const dy = y - b.y, q = b.r * b.r - dy * dy - (x / b.sx) ** 2;
      if (q > 0) z = Math.min(z, b.z - b.sz * Math.sqrt(q));
    }
    return z;
  };
}


// ================= CORREDOR (Lula) =================
export function criaCorredor(P) {
  const neon = !!P.neon, macacao = !!P.macacao;
  const corCamisa = P.camisa ?? P.mochila ?? 0xbcd3ee;
  const corGravata = P.gravata ?? P.bone;
  const root = new THREE.Group();
  const corpo = new THREE.Group(); corpo.position.y = 0.95; root.add(corpo);

  // ---- materiais ----
  const mCasaco = tecido(P.casaco, 0.55);
  const mCasacoEsc = tecido(escurece(P.casaco, 0.7), 0.6);      // lapelas, bolsos, costuras
  const mCalca = tecido(P.calca, 0.58);
  const mPele = peleMat(P.pele);
  const mCabelo = cabeloMat(P.cabelo);
  const mSobr = cabeloMat(macacao ? escurece(P.cabelo, 0.8) : new THREE.Color(0x6e6862));
  const mCamisa = tecido(corCamisa, 0.5);
  const mGravata = tecido(corGravata, 0.42);
  const mListra = tecido(clareia(corGravata, 0.35), 0.45);
  const mSapato = macacao ? tecido(P.tenis, 0.7) : vernizMat(P.tenis);
  const mSola = tecido(macacao ? 0x2a2420 : 0x161412, 0.7);
  if (neon) {
    acende(mCasacoEsc, P.bone, 0.9);
    acende(mGravata, corGravata, 0.9);
    acende(mListra, corCamisa, 1.0);
    acende(mCamisa, corCamisa, 0.45);
    acende(mSapato, P.tenis, 0.7);
    mCabelo.emissive = new THREE.Color(P.cabelo); mCabelo.emissiveIntensity = 0.15;
  }

  // =============== TRONCO (compacto: a cabeça é que manda) ===============
  const tronco = new THREE.Group(); corpo.add(tronco);
  const EZ = 0.7;
  const PERFIL = [
    [0, -0.16], [0.3, -0.16], [0.318, -0.1], [0.322, 0.05], [0.328, 0.22], [0.335, 0.38],
    [0.33, 0.47], [0.3, 0.54], [0.22, 0.6], [0.13, 0.63], [0, 0.64],
  ];
  const BARRIGA = { y: 0.12, z: -0.04, r: 0.24, sx: 1.18, sz: 0.85 };
  tronco.add(malha(junta([
    [torno(PERFIL, 26, EZ), {}],
    [new THREE.SphereGeometry(BARRIGA.r, 20, 14), { p: [0, BARRIGA.y, BARRIGA.z], s: [BARRIGA.sx, 1.0, BARRIGA.sz] }],
    [new THREE.SphereGeometry(0.14, 14, 10), { p: [-0.3, 0.49, 0.0], s: [1.1, 0.75, 0.95] }],   // ombreiras
    [new THREE.SphereGeometry(0.14, 14, 10), { p: [0.3, 0.49, 0.0], s: [1.1, 0.75, 0.95] }],
  ]), mCasaco));
  const fz = superficieFrente(PERFIL, EZ, BARRIGA);
  const esc = [], cam = [], grav = [], lis = [];
  if (!macacao) {
    // ---- camisa em "V", colarinho, gravata, lapelas, botões, bolsos (colados no peito) ----
    const V0 = 0.22, V1 = 0.62;
    cam.push([colado([[-0.14, V1], [0.14, V1], [0, V0]], 0.004, 0.003, fz, 0.001), {}]);
    cam.push([colado([[-0.13, 0.66], [-0.005, 0.56], [-0.075, 0.52]], 0.01, 0.006, fz, 0.012), {}]); // pontas do colarinho
    cam.push([colado([[0.13, 0.66], [0.075, 0.52], [0.005, 0.56]], 0.01, 0.006, fz, 0.012), {}]);
    cam.push([new THREE.TorusGeometry(0.12, 0.028, 8, 22), { p: [0, 0.63, 0.0], r: [Math.PI / 2 - 0.15, 0, 0] }]);
    grav.push([colado([[-0.035, 0.6], [0.035, 0.6], [0.026, 0.53], [-0.026, 0.53]], 0.016, 0.008, fz, 0.01), {}]); // nó
    grav.push([colado([[-0.024, 0.535], [0.024, 0.535], [0.055, 0.2], [0, 0.15], [-0.055, 0.2]], 0.006, 0.004, fz, 0.006), {}]);
    if (P.gravata !== undefined || neon)
      for (const y of [0.47, 0.39, 0.31, 0.23])
        lis.push([colado([[-0.05, y], [0.05, y + 0.035], [0.05, y + 0.055], [-0.05, y + 0.02]], 0.003, 0.002, fz, 0.012), {}]);
    const lapE = [[-0.14, 0.62], [-0.004, V0 - 0.02], [-0.21, 0.44], [-0.19, 0.5], [-0.24, 0.53], [-0.2, 0.6]];
    esc.push([colado(lapE, 0.01, 0.007, fz, 0.018), {}]);
    esc.push([colado(lapE.map(([x, y]) => [-x, y]), 0.01, 0.007, fz, 0.018), {}]);
    const bot = new THREE.CylinderGeometry(0.024, 0.024, 0.014, 12);
    for (const y of [0.14, 0.01]) esc.push([bot.clone(), { p: [0, y, fz(0, y) - 0.006], r: [Math.PI / 2 - 0.1, 0, 0] }]);
    bot.dispose();
    esc.push([new THREE.BoxGeometry(0.17, 0.035, 0.03), { p: [-0.2, -0.01, fz(-0.2, -0.01) + 0.004], r: [0, 0.55, 0] }]); // bolsos
    esc.push([new THREE.BoxGeometry(0.17, 0.035, 0.03), { p: [0.2, -0.01, fz(0.2, -0.01) + 0.004], r: [0, -0.55, 0] }]);
    esc.push([new THREE.BoxGeometry(0.1, 0.025, 0.02), { p: [0.19, 0.4, fz(0.19, 0.4) + 0.004], r: [0, -0.45, 0] }]); // bolsinho
    esc.push([tubo([0, 0.6, 0.23], [0, -0.14, 0.23], 0.008, 4), {}]); // costura das costas
  } else {
    // ---- macacão: gola, zíper, bolsos com lapela, cinto ----
    esc.push([new THREE.TorusGeometry(0.13, 0.04, 8, 22), { p: [0, 0.62, 0.0], r: [Math.PI / 2 - 0.15, 0, 0] }]);
    esc.push([colado([[-0.015, 0.6], [0.015, 0.6], [0.015, -0.1], [-0.015, -0.1]], 0.006, 0.004, fz, 0.006), {}]);
    esc.push([colado([[-0.24, 0.42], [-0.08, 0.42], [-0.08, 0.36], [-0.24, 0.36]], 0.01, 0.006, fz, 0.012), {}]);
    esc.push([colado([[0.08, 0.42], [0.24, 0.42], [0.24, 0.36], [0.08, 0.36]], 0.01, 0.006, fz, 0.012), {}]);
    esc.push([torno([[0.33, -0.08], [0.335, 0.0]], 26, EZ * 1.04), {}]); // cinto
    esc.push([tubo([0, 0.55, 0.23], [0, -0.14, 0.23], 0.008, 4), {}]);
  }

  // ---- faixa presidencial (ombro direito → quadril esquerdo) ----
  if (P.faixa) {
    const A = 0.62, RX = 0.325 / Math.cos(A) + 0.02, EZF = (0.335 * EZ + 0.05) / RX;
    const banda = (h, k) => em(new THREE.CylinderGeometry(RX * k, RX * k, h, 32, 1, true), { s: [1, 1, EZF] });
    const T = { p: [0, 0.25, -0.01], r: [0, 0, A] };
    const mVerde = tecido(0x13a04a, 0.5), mAmar = tecido(0xffd21f, 0.45);
    mVerde.side = mAmar.side = THREE.DoubleSide;
    tronco.add(malha(junta([[banda(0.15, 1.0), T]]), mVerde));
    tronco.add(malha(junta([
      [banda(0.065, 1.012), T],
      [new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), { p: [-0.2, 0.06, fz(-0.2, 0.06) - 0.03], r: [Math.PI / 2, 0, 0] }], // medalhão
    ]), mAmar));
  }
  tronco.add(malha(junta(esc), mCasacoEsc));
  if (cam.length) tronco.add(malha(junta(cam), mCamisa));
  if (grav.length) tronco.add(malha(junta(grav), mGravata));
  if (lis.length) tronco.add(malha(junta(lis), mListra));

  // =============== CABEÇA ===============
  const cabeca = new THREE.Group(); cabeca.position.y = 0.58; tronco.add(cabeca);
  const H = criaCabeca({
    r: 0.36, cy: 0.4, pele: mPele, sobr: mSobr, iris: 0x5a3216, olho: 1.0, palp: 0.36, palpInc: 0.1,
    sobrAng: -0.3, sobrEsp: 1.35, boca: 'sorriso', nariz: 1.35, queixo: 1.05, pescoco: 0.11, orelha: 1.15,
  });
  cabeca.add(H.g);
  const { zf, r, cy } = H;
  const pelo = [];
  if (!macacao) {
    // cabelo branco cheio: calota inclinada pra trás + topete + laterais volumosas
    pelo.push([new THREE.SphereGeometry(r * 1.07, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, cy + r * 0.04, r * 0.02], r: [0.55, 0, 0], s: [1.02, 1.05, 0.98] }]);
    pelo.push([new THREE.SphereGeometry(r * 0.5, 16, 10), { p: [0.04, cy + r * 0.78, -r * 0.42], s: [1.5, 0.55, 0.85], r: [0.3, 0, -0.08] }]); // topete
    pelo.push([new THREE.SphereGeometry(r * 0.42, 14, 10), { p: [-r * 0.28, cy + r * 0.72, -r * 0.3], s: [1.1, 0.6, 0.9] }]);
  } else {
    pelo.push([new THREE.SphereGeometry(r * 1.05, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), { p: [0, cy, r * 0.02], r: [0.7, 0, 0], s: [1.02, 1.02, 0.98] }]);
  }
  for (const sx of [-1, 1]) {
    pelo.push([new THREE.SphereGeometry(r * 0.34, 14, 10), { p: [sx * r * 0.86, cy + r * 0.28, r * 0.12], s: [0.55, 1.1, 1.05] }]); // laterais
    pelo.push([new THREE.SphereGeometry(r * 0.3, 12, 8), { p: [sx * r * 0.62, cy + r * 0.2, r * 0.62], s: [0.8, 1.1, 0.7] }]); // nuca
    // costeletas descendo pra barba
    pelo.push([tubo([sx * r * 0.92, cy + r * 0.05, -r * 0.02], [sx * r * 0.8, cy - r * 0.45, -r * 0.3], r * 0.11, 8), {}]);
  }
  // barba cheia: uma casca contínua de orelha a orelha envolvendo a boca + bigode
  pelo.push([new THREE.SphereGeometry(r * 0.8, 26, 10, 0, Math.PI * 2, Math.PI * 0.47, Math.PI * 0.53),
    { p: [0, cy - r * 0.3, -r * 0.06], s: [1.2, 0.95, 1.12] }]);
  const yM = cy - r * 0.32, zM = -r * 1.0;
  for (const sx of [-1, 1])
    pelo.push([tubo([sx * r * 0.03, yM, zM - r * 0.02], [sx * r * 0.3, yM - r * 0.08, zM + r * 0.1], r * 0.08, 8), {}]); // bigode
  // dentes (brancos como o cabelo, mesma malha)
  if (!macacao) pelo.push([new THREE.BoxGeometry(r * 0.36, r * 0.07, r * 0.04), { p: [0, cy - r * 0.47, zM - r * 0.005], r: [0.15, 0, 0] }]);
  cabeca.add(malha(junta(pelo), mCabelo));
  { // boca sorrindo aberta na frente da barba
    const w = r * 0.22, D = new THREE.Shape();
    D.moveTo(-w, 0); D.bezierCurveTo(-w * 0.9, -w * 0.95, w * 0.9, -w * 0.95, w, 0); D.quadraticCurveTo(0, w * 0.15, -w, 0);
    cabeca.add(malha(extruda(D, r * 0.03, r * 0.01, false), tecido(0x4a1210, 0.6), { p: [0, cy - r * 0.44, -r * 0.975], r: [0.15, Math.PI, 0] }));
  }
  if (macacao) { // capacete amarelo de fábrica
    const mCap = tecido(P.bone, 0.35);
    cabeca.add(malha(junta([
      [new THREE.SphereGeometry(r * 1.13, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, cy + r * 0.12, 0], s: [1, 0.95, 1] }],
      [new THREE.CylinderGeometry(r * 1.22, r * 1.26, r * 0.07, 28), { p: [0, cy + r * 0.12, -r * 0.05], s: [1, 1, 1.08] }],
      [tubo([0, cy + r * 1.2, -r * 0.6], [0, cy + r * 1.2, r * 0.6], r * 0.08, 8), { r: [0, 0, 0] }],
    ]), mCap));
  }

  // =============== BRAÇOS (pivô no ombro, membro pende pra -y) ===============
  const manga = torno([
    [0, -0.4], [0.088, -0.4], [0.093, -0.3], [0.1, -0.15], [0.108, -0.02], [0.1, 0.05], [0.06, 0.085], [0, 0.09],
  ], 16);
  const punho = new THREE.CylinderGeometry(0.08, 0.078, 0.06, 14);
  const mao = geoMao(1.12);
  const braco = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0.5, 0);
    piv.add(malha(manga, mCasaco));
    piv.add(malha(punho, macacao ? mCasacoEsc : mCamisa, { p: [0, -0.42, 0] }));
    piv.add(malha(mao, mPele, { p: [0, -0.43, 0] }));
    tronco.add(piv); return piv;
  };
  const bracoE = braco(-0.41), bracoD = braco(0.41);

  // ---- pasta de documentos na mão esquerda ----
  if (P.pasta) {
    const mCouro = vernizMat(0x3a2418);
    const pasta = new THREE.Group(); pasta.position.set(0, -0.6, -0.02); bracoE.add(pasta);
    pasta.add(malha(junta([
      [extruda(retRedondo(0.42, 0.3, 0.04), 0.08, 0.015), { p: [0, -0.2, 0], r: [0, Math.PI / 2, 0] }],
      [new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), { p: [0, -0.04, 0], r: [0, Math.PI / 2, 0] }],
    ]), mCouro));
    pasta.add(malha(junta([
      [new THREE.BoxGeometry(0.1, 0.035, 0.045), { p: [0, -0.1, -0.12] }],
      [new THREE.BoxGeometry(0.1, 0.035, 0.045), { p: [0, -0.1, 0.12] }],
    ]), metal(0xe0b12e, 0.3)));
  }

  // =============== PERNAS (pivô no quadril) ===============
  const calca = torno([
    [0, -0.76], [0.125, -0.76], [0.13, -0.66], [0.126, -0.5], [0.135, -0.2], [0.148, 0], [0.12, 0.07], [0, 0.08],
  ], 16);
  const S = geoSapato(0.9, 1.12);
  let bot = null;
  if (macacao) { // cano da botina
    bot = new THREE.CylinderGeometry(0.135, 0.14, 0.14, 16); bot.translate(0, -0.72, 0.01);
    S.cab = junta([[S.cab, {}], [bot, {}]]);
  }
  const sola = junta([[S.sola, {}], [S.det, {}]]);
  const perna = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0, 0);
    piv.add(malha(calca, mCalca));
    piv.add(malha(S.cab, mSapato));
    piv.add(malha(sola, mSola));
    corpo.add(piv); return piv;
  };
  const pernaE = perna(-0.17), pernaD = perna(0.17);

  // ---- prancha flutuante e jato ----
  const { prancha, jato, chama } = criaPranchaJato(tronco, [0, 0.25, 0.4]);
  root.add(prancha);

  return { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama };
}

// ================= SEGURANÇA + CACHORRO =================
export function criaVigia() {
  const root = new THREE.Group();
  const corpo = new THREE.Group(); corpo.position.y = 1.05; root.add(corpo);

  const terno = tecido(0x1c1c22, 0.55);
  const pretoEsc = tecido(0x0b0b0e, 0.5);
  const pele = peleMat(0xd9a27a);
  const sobr = cabeloMat(0x4a2e1c);
  const lente = new THREE.MeshStandardMaterial({ color: 0x060608, roughness: 0.08, metalness: 0.85 });
  const fone = new THREE.MeshStandardMaterial({ color: 0xe6eef2, roughness: 0.25, transparent: true, opacity: 0.9 });

  // ---- tronco de armário: paletó preto largo ----
  const EZ = 0.74;
  const PERFIL = [
    [0, -0.16], [0.36, -0.16], [0.38, 0.06], [0.4, 0.3], [0.44, 0.52], [0.43, 0.62], [0.34, 0.7], [0.18, 0.74], [0, 0.75],
  ];
  corpo.add(malha(junta([
    [torno(PERFIL, 26, EZ), {}],
    [new THREE.SphereGeometry(0.18, 14, 10), { p: [-0.4, 0.6, 0], s: [1.1, 0.75, 0.95] }],
    [new THREE.SphereGeometry(0.18, 14, 10), { p: [0.4, 0.6, 0], s: [1.1, 0.75, 0.95] }],
  ]), terno));
  const fz = superficieFrente(PERFIL, EZ);
  const V0 = 0.26, V1 = 0.74;
  const lapE = [[-0.16, V1], [-0.004, V0 - 0.02], [-0.27, 0.52], [-0.24, 0.58], [-0.29, 0.62], [-0.21, V1 + 0.01]];
  const bt = new THREE.CylinderGeometry(0.026, 0.026, 0.014, 12);
  corpo.add(malha(junta([
    [colado([[-0.16, V1], [0.16, V1], [0, V0]], 0.004, 0.003, fz, 0.001), {}],                         // camisa preta
    [colado([[-0.04, 0.72], [0.04, 0.72], [0.03, 0.64], [-0.03, 0.64]], 0.014, 0.007, fz, 0.01), {}],  // nó da gravata
    [colado([[-0.028, 0.645], [0.028, 0.645], [0.06, 0.28], [0, 0.22], [-0.06, 0.28]], 0.006, 0.004, fz, 0.007), {}],
    [colado(lapE, 0.01, 0.007, fz, 0.018), {}],
    [colado(lapE.map(([x, y]) => [-x, y]), 0.01, 0.007, fz, 0.018), {}],
    [bt.clone(), { p: [0, 0.16, fz(0, 0.16) - 0.006], r: [Math.PI / 2 - 0.1, 0, 0] }],
    [bt, { p: [0, 0.02, fz(0, 0.02) - 0.006], r: [Math.PI / 2 - 0.05, 0, 0] }],
    [new THREE.BoxGeometry(0.19, 0.04, 0.03), { p: [-0.24, 0.02, fz(-0.24, 0.02) + 0.006], r: [0, 0.6, 0] }],
    [new THREE.BoxGeometry(0.19, 0.04, 0.03), { p: [0.24, 0.02, fz(0.24, 0.02) + 0.006], r: [0, -0.6, 0] }],
    [new THREE.TorusGeometry(0.14, 0.03, 8, 22), { p: [0, 0.74, 0.01], r: [Math.PI / 2 - 0.1, 0, 0] }],     // colarinho
    [tubo([0, 0.7, 0.3], [0, -0.14, 0.3], 0.009, 4), {}],                                                  // costura das costas
  ]), pretoEsc));

  // ---- cabeça careca, sobrancelhas bravas, óculos escuros, boca séria ----
  const cab = new THREE.Group(); cab.position.y = 0.7; corpo.add(cab);
  const H = criaCabeca({
    r: 0.37, cy: 0.42, pele, sobr, semOlhos: true, palp: 0, sobrAng: 1.0, sobrEsp: 1.6, sobrY: 0.42 + 0.37 * 0.06 + 0.13, boca: 'serio',
    nariz: 1.3, queixo: 1.25, pescoco: 0.15, orelha: 1.1,
  });
  cab.add(H.g);
  const { zf, r, cy } = H;
  const ey = cy + r * 0.06, ex = r * 0.36;
  const lenteG = extruda(retRedondo(0.18, 0.11, 0.03), 0.016, 0.008);
  const oc = [];
  for (const sx of [-1, 1]) {
    const x = sx * ex;
    oc.push([lenteG.clone(), { p: [x, ey, zf(x, ey) - 0.012], r: [0, -Math.asin(x / r) * 0.9, 0] }]);
    oc.push([tubo([sx * 0.215, ey + 0.03, zf(0.215, ey) + 0.01], [sx * r * 1.0, ey + 0.03, 0.03], 0.011, 4), {}]); // hastes
  }
  lenteG.dispose();
  oc.push([new THREE.BoxGeometry(0.07, 0.02, 0.02), { p: [0, ey + 0.035, zf(0, ey) - 0.03] }]); // ponte
  oc.push([tubo([-r * 0.15, cy - r * 0.47, -r * 0.93], [r * 0.15, cy - r * 0.45, -r * 0.93], 0.012, 6), {}]); // boca séria
  cab.add(malha(junta(oc), lente));
  // ponto no ouvido direito com fio espiral descendo pro colarinho
  const espiral = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, a = t * Math.PI * 12;
    espiral.push(new THREE.Vector3(r * 1.02 + Math.cos(a) * 0.014 - t * 0.06, cy - r * 0.15 - t * 0.38, -0.02 + Math.sin(a) * 0.014 + t * 0.06));
  }
  cab.add(malha(junta([
    [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(espiral), 100, 0.007, 4), {}],
    [new THREE.SphereGeometry(0.03, 8, 6), { p: [r * 1.04, cy - r * 0.08, -0.02] }],
  ]), fone));

  // ---- pernas: calça preta + sapato social grande ----
  const gCalca = torno([[0, -0.86], [0.15, -0.86], [0.155, -0.6], [0.165, -0.2], [0.175, 0], [0.14, 0.08], [0, 0.09]], 16);
  const S = geoSapato(1.05, 1.28);
  const gSola = junta([[S.sola, {}], [S.det, {}]]);
  const gSap = junta([[S.cab, {}]]);
  const perna = x => {
    const p = new THREE.Group(); p.position.set(x, 0, 0);
    p.add(malha(gCalca, terno));
    p.add(malha(gSap, lente));
    p.add(malha(gSola, pretoEsc));
    corpo.add(p); return p;
  };
  const pE = perna(-0.2), pD = perna(0.2);

  // ---- braços: ombro → cotovelo dobrado → antebraço, mão grande ----
  const gBraco = junta([
    [new THREE.CapsuleGeometry(0.13, 0.2, 4, 14), { p: [0, -0.17, 0] }],
    [new THREE.SphereGeometry(0.125, 14, 10), { p: [0, -0.34, 0] }],
  ]);
  const gAnte = junta([
    [new THREE.CapsuleGeometry(0.115, 0.18, 4, 14), { p: [0, -0.14, 0] }],
    [new THREE.TorusGeometry(0.1, 0.02, 6, 16), { p: [0, -0.25, 0], r: [Math.PI / 2, 0, 0] }],
  ]);
  const gMao = geoMao(1.35);
  const braco = x => {
    const p = new THREE.Group(); p.position.set(x, 0.6, 0);
    const abre = new THREE.Group(); abre.rotation.z = Math.sign(x) * 0.12; p.add(abre);
    abre.add(malha(gBraco, terno));
    const ante = new THREE.Group(); ante.position.y = -0.34; ante.rotation.x = 0.85; abre.add(ante);
    ante.add(malha(gAnte, terno));
    ante.add(malha(gMao, pele, { p: [0, -0.28, 0] }));
    corpo.add(p); p.ante = ante; return p;
  };
  const bE = braco(-0.54), bD = braco(0.54);

  // ---- cachorro caramelo cartoon ----
  const cao = new THREE.Group(); cao.position.set(1.0, 0, 0.3);
  const caramelo = tecido(0xd08a3c, 0.62), creme = tecido(0xf3d3a0, 0.62), marrom = tecido(0x9a5522, 0.6);
  const preto = new THREE.MeshStandardMaterial({ color: 0x120c0a, roughness: 0.2 });
  const branco = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  // rabo enrolado pra cima (curva)
  const rabo = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, a = t * Math.PI * 1.1;
    rabo.push(new THREE.Vector3(0, 0.68 + Math.sin(a) * 0.2, 0.3 + (1 - Math.cos(a)) * 0.1 - t * 0.05));
  }
  cao.add(malha(junta([
    [new THREE.CapsuleGeometry(0.17, 0.3, 6, 14), { p: [0, 0.58, 0.04], r: [Math.PI / 2, 0, 0] }],     // corpo
    [new THREE.SphereGeometry(0.14, 14, 10), { p: [0, 0.72, -0.24] }],                                  // pescoço
    [new THREE.SphereGeometry(0.24, 22, 16), { p: [0, 0.94, -0.36], s: [1.05, 0.95, 1] }],             // cabeça grande
    [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rabo), 16, 0.045, 6), {}],
  ]), caramelo));
  cao.add(malha(junta([
    [new THREE.SphereGeometry(0.12, 14, 10), { p: [0, 0.86, -0.56], s: [1.1, 0.8, 1.0] }],             // focinho
    [new THREE.SphereGeometry(0.12, 12, 8), { p: [0, 0.55, -0.2], s: [0.95, 1, 0.8] }],                // peito
    [new THREE.SphereGeometry(0.06, 8, 6), { p: [0, 0.88, 0.3 + 0.2 - 0.05] }],                         // ponta do rabo
  ]), creme));
  const gOrelha = new THREE.SphereGeometry(0.11, 12, 8);
  cao.add(malha(junta([
    [gOrelha.clone(), { p: [-0.21, 1.02, -0.34], r: [0.1, 0, 0.5], s: [0.45, 1.2, 0.85] }],
    [gOrelha, { p: [0.21, 1.02, -0.34], r: [0.1, 0, -0.5], s: [0.45, 1.2, 0.85] }],
  ]), marrom));
  const gOlho = new THREE.SphereGeometry(0.055, 12, 10);
  cao.add(malha(junta([
    [gOlho.clone(), { p: [-0.09, 0.99, -0.55], s: [1, 1.15, 0.6] }],
    [gOlho, { p: [0.09, 0.99, -0.55], s: [1, 1.15, 0.6] }],
  ]), branco));
  cao.add(malha(junta([
    [new THREE.SphereGeometry(0.045, 10, 8), { p: [0, 0.9, -0.67], s: [1.3, 0.9, 1] }],                 // nariz
    [new THREE.SphereGeometry(0.036, 10, 8), { p: [-0.09, 0.985, -0.585], s: [1, 1.1, 0.5] }],           // pupilas
    [new THREE.SphereGeometry(0.036, 10, 8), { p: [0.09, 0.985, -0.585], s: [1, 1.1, 0.5] }],
    [arco(0.05, 0.009, Math.PI * 0.7, 10), { p: [0, 0.83, -0.66], r: [0.2, 0, 0] }],                   // sorriso
  ]), preto));
  cao.add(malha(junta([
    [new THREE.SphereGeometry(0.012, 6, 4), { p: [-0.1, 1.0, -0.605] }],
    [new THREE.SphereGeometry(0.012, 6, 4), { p: [0.08, 1.0, -0.605] }],
  ]), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  cao.add(malha(new THREE.TorusGeometry(0.135, 0.03, 8, 20), tecido(0xd42a2a, 0.45), { p: [0, 0.74, -0.25], r: [Math.PI / 2 - 0.6, 0, 0] })); // coleira
  // patas: pivô no topo, perna pende pra baixo
  const gPata = junta([
    [new THREE.CapsuleGeometry(0.06, 0.3, 4, 10), { p: [0, -0.2, 0] }],
    [new THREE.SphereGeometry(0.08, 10, 8), { p: [0, -0.43, -0.03], s: [1, 0.6, 1.3] }],
  ]);
  const patas = [[-0.11, -0.18], [0.11, -0.18], [-0.11, 0.24], [0.11, 0.24]].map(([x, z]) => {
    const piv = new THREE.Group(); piv.position.set(x, 0.48, z);
    piv.add(malha(gPata, caramelo));
    cao.add(piv); return piv;
  });
  root.add(cao);

  return { root, corpo, pE, pD, bE, bD, cao, patas };
}
