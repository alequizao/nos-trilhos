/*
 * Nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Flávio nos Trilhos — corredor caricato do Flávio no estilo cartoon "vinil 3D"
// (cabeça grande, olhos expressivos, mãos de luva, sapatos grandes). Só primitivas
// do Three.js, sem texturas; peças da mesma cor fundidas (junta) → poucos draw calls.
//
// criaCorredor(P) — campos aceitos em P (cores em hexa numérico):
//   casaco   cor do paletó (ou da jaqueta de couro, se P.macacao; camisa, se P.selecao)
//   calca    cor da calça
//   camisa/mochila  cor da camisa social (P.mochila é o nome usado nas SKINS)
//   bone     cor da gravata (ou do capacete, se P.macacao; da gola, se P.selecao)
//   gravata  (opcional) sobrepõe a cor da gravata; listra = cor das listras
//   tenis    cor dos sapatos
//   pele / cabelo
//   pasta    true → pasta executiva na mão esquerda
//   faixa    true → faixa presidencial verde-amarela
//   macacao  true → "Flávio Motociata": jaqueta de couro com zíper e capacete de moto
//   selecao  true → "Flávio Verde-Amarelo": camisa amarela de futebol com gola verde
//   neon     true → detalhes brilhando (lapelas, gravata, camisa, sapatos)
// Retorna { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama }
// (o personagem olha para -z; bracoD/pernaD ficam em +x).
import * as THREE from 'three';
import { junta, malha, torno, extruda, retRedondo, tubo, tecido, peleMat, cabeloMat, vernizMat, metal, escurece, clareia,
  acende, criaCabeca, geoMao, geoSapato, geoTenis, criaPranchaJato } from './personagens-base.js?v=1.0.5';

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
  // quebra triângulos grandes (lado > 3 cm) pra peça conseguir dobrar na curva
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
    let z = -ez * r * Math.sqrt(Math.max(0, 1 - (x / r) ** 2));
    if (b) {
      const dy = y - b.y, q = b.r * b.r - dy * dy - (x / b.sx) ** 2;
      if (q > 0) z = Math.min(z, b.z - b.sz * Math.sqrt(q));
    }
    return z;
  };
}

// estrela de 5 pontas
function estrela(rExt, rInt) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? rInt : rExt;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return poligono(pts);
}


// ================= CORREDOR (Flávio) =================
export function criaCorredor(P) {
  const neon = !!P.neon, macacao = !!P.macacao, selecao = !!P.selecao;
  const corCamisa = P.camisa ?? P.mochila ?? 0xf6f6f4;
  const corGravata = P.gravata ?? P.bone;
  const root = new THREE.Group();
  const corpo = new THREE.Group(); corpo.position.y = 0.95; root.add(corpo);

  // ---- materiais ----
  const mCasaco = macacao ? vernizMat(P.casaco) : tecido(P.casaco, 0.58);
  const mCasacoEsc = tecido(escurece(P.casaco, selecao ? 0.85 : 0.7), 0.6);   // lapelas, bolsos, costuras
  const mCalca = tecido(P.calca, 0.6);
  const mPele = peleMat(P.pele);
  const mCabelo = cabeloMat(P.cabelo);
  const mSobr = cabeloMat(escurece(P.cabelo, 0.8));
  const mCamisa = tecido(corCamisa, 0.5);
  const mGravata = tecido(corGravata, 0.45);
  const mListra = P.listra !== undefined ? new THREE.MeshStandardMaterial({ color: P.listra, roughness: 0.35, metalness: 0.35 })
    : tecido(clareia(corGravata, 0.35), 0.45);
  const mSapato = vernizMat(P.tenis);
  const mSola = tecido(macacao ? 0x2a2420 : 0x141210, 0.7);
  const mVerde = tecido(P.bone, 0.5);
  if (neon) {
    acende(mCasacoEsc, P.bone, 0.9);
    acende(mGravata, corGravata === P.bone ? P.bone : corGravata, 0.9);
    acende(mListra, corCamisa, 1.0);
    acende(mCamisa, corCamisa, 0.45);
    acende(mSapato, P.tenis, 0.7);
  }

  // =============== TRONCO ===============
  const tronco = new THREE.Group(); corpo.add(tronco);
  // peito: todo o paletó num subgrupo achatado em y (tronco curto, cabeça grande de boneco)
  const peito = new THREE.Group(); peito.scale.y = 0.8; tronco.add(peito);
  const EZ = 0.7;
  const PERFIL = [
    [0, -0.2], [0.3, -0.2], [0.322, -0.15], [0.326, 0.05], [0.33, 0.3], [0.335, 0.46], [0.315, 0.56], [0.24, 0.63], [0.12, 0.66], [0, 0.665],
  ];
  const fz = superficieFrente(PERFIL, EZ);
  peito.add(malha(junta([
    [torno(PERFIL, 26, EZ), {}],
    [new THREE.SphereGeometry(0.14, 14, 10), { p: [-0.3, 0.5, 0.0], s: [1.15, 0.8, 0.95] }],   // ombreiras
    [new THREE.SphereGeometry(0.14, 14, 10), { p: [0.3, 0.5, 0.0], s: [1.15, 0.8, 0.95] }],
  ]), mCasaco));

  const V0 = 0.22, V1 = 0.66; // decote do paletó (camisa aparece)
  if (selecao) {
    // camisa de futebol: gola V verde, faixas verdes nos lados, escudo
    peito.add(malha(junta([
      [colado([[-0.13, 0.64], [-0.08, 0.64], [0, 0.5], [0.08, 0.64], [0.13, 0.64], [0, 0.44]], 0.01, 0.006, fz, 0.004), {}],
      [colado([[0.1, 0.46], [0.18, 0.46], [0.18, 0.36], [0.14, 0.32], [0.1, 0.36]], 0.008, 0.005, fz, 0.004), {}],
      [new THREE.TorusGeometry(0.325, 0.022, 6, 28), { p: [0, -0.16, 0], r: [Math.PI / 2, 0, 0], s: [1, EZ, 1] }],
    ]), mVerde));
  } else if (macacao) {
    // jaqueta de couro: gola alta, zíper, bolsos
    peito.add(malha(junta([
      [new THREE.TorusGeometry(0.14, 0.045, 8, 20), { p: [0, 0.64, 0.0], r: [Math.PI / 2 - 0.15, 0, 0], s: [1.1, 1, 1] }],
      [colado([[-0.2, 0.08], [-0.08, 0.08], [-0.08, 0.14], [-0.2, 0.14]], 0.01, 0.006, fz, 0.004), {}],
      [colado([[0.08, 0.08], [0.2, 0.08], [0.2, 0.14], [0.08, 0.14]], 0.01, 0.006, fz, 0.004), {}],
      [new THREE.TorusGeometry(0.325, 0.03, 6, 28), { p: [0, -0.16, 0], r: [Math.PI / 2, 0, 0], s: [1, EZ, 1] }],
    ]), mCasacoEsc));
    peito.add(malha(colado([[-0.012, 0.62], [0.012, 0.62], [0.012, -0.18], [-0.012, -0.18]], 0.006, 0.004, fz, 0.012), metal(0xc9ccd2, 0.3)));
  } else {
    // camisa em V + colarinho
    peito.add(malha(junta([
      [colado([[-0.13, V1], [0.13, V1], [0, V0]], 0.004, 0.003, fz, 0.001), {}],
      [colado([[-0.13, 0.66], [-0.02, 0.6], [-0.07, 0.54], [-0.15, 0.62]], 0.01, 0.006, fz, 0.012), {}],
      [colado([[0.13, 0.66], [0.02, 0.6], [0.07, 0.54], [0.15, 0.62]], 0.01, 0.006, fz, 0.012), {}],
    ]), mCamisa));
    // gravata: nó + lâmina
    peito.add(malha(junta([
      [colado([[-0.035, 0.61], [0.035, 0.61], [0.026, 0.55], [-0.026, 0.55]], 0.014, 0.008, fz, 0.012), {}],
      [colado([[-0.026, 0.555], [0.026, 0.555], [0.05, 0.3], [0, 0.25], [-0.05, 0.3]], 0.006, 0.004, fz, 0.008), {}],
    ]), mGravata));
    // listras diagonais da gravata
    const listras = [];
    for (let y = 0.33; y < 0.55; y += 0.05) {
      const w = 0.028 + (0.55 - y) * 0.09;
      listras.push([colado([[-w, y], [w, y + 0.03], [w, y + 0.045], [-w, y + 0.015]], 0.003, 0.002, fz, 0.017), {}]);
    }
    peito.add(malha(junta(listras), mListra));
    // lapelas, bolsos com lapela, botão, costura das costas
    const lapE = [[-0.135, V1 + 0.005], [-0.004, V0 - 0.02], [-0.21, 0.46], [-0.19, 0.52], [-0.24, 0.55], [-0.18, V1 + 0.01]];
    const bot = new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12);
    peito.add(malha(junta([
      [colado(lapE, 0.01, 0.007, fz, 0.016), {}],
      [colado(lapE.map(([x, y]) => [-x, y]), 0.01, 0.007, fz, 0.016), {}],
      [colado([[-0.27, 0.0], [-0.11, 0.0], [-0.11, 0.04], [-0.27, 0.04]], 0.008, 0.005, fz, 0.006), {}],
      [colado([[0.11, 0.0], [0.27, 0.0], [0.27, 0.04], [0.11, 0.04]], 0.008, 0.005, fz, 0.006), {}],
      [colado([[0.12, 0.38], [0.22, 0.38], [0.22, 0.4], [0.12, 0.4]], 0.006, 0.004, fz, 0.006), {}],
      [bot.clone(), { p: [0, 0.14, fz(0, 0.14) - 0.008], r: [Math.PI / 2, 0, 0] }],
      [bot, { p: [0, 0.02, fz(0, 0.02) - 0.008], r: [Math.PI / 2, 0, 0] }],
      [new THREE.BoxGeometry(0.012, 0.6, 0.012), { p: [0, 0.18, 0.232] }],                         // costura das costas
      [new THREE.TorusGeometry(0.13, 0.03, 8, 20), { p: [0, 0.64, 0.015], r: [Math.PI / 2 - 0.2, 0, 0] }], // gola atrás
    ]), mCasacoEsc));
  }

  // ---- faixa presidencial (se houver) ----
  if (P.faixa) {
    const faixa = (d, w) => [new THREE.TorusGeometry(0.4, w, 4, 36), { p: [0, 0.2, 0], r: [0, 0, 0.72], s: [1, 1.08, 0.66] }];
    peito.add(malha(junta([faixa(0, 0.035)]), tecido(0x1f9a46, 0.5)));
  }

  // =============== CABEÇA ===============
  const cabeca = new THREE.Group(); cabeca.position.y = 0.45; tronco.add(cabeca);
  const H = criaCabeca({ r: 0.4, cy: 0.42, pele: mPele, sobr: mSobr, iris: 0x7a4418, olho: 1.0, palp: 0.3,
    sobrAng: -0.15, sobrEsp: 1.45, nariz: 1.25, boca: 'sorriso', queixo: 1.02, pescoco: 0.11 });
  cabeca.add(H.g);
  const r = H.r, cy = H.cy;
  if (!macacao) {
    // cabelo escuro curto e cheio, penteado de lado (risca à esquerda do personagem = +x)
    cabeca.add(malha(junta([
      [new THREE.SphereGeometry(r * 1.06, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, cy + 0.03, 0.02], r: [0.34, 0, 0], s: [1.03, 1.02, 1.03] }],
      [new THREE.SphereGeometry(r * 1.05, 24, 12, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.35, Math.PI * 0.38), { p: [0, cy, 0.02] }], // nuca
      // volume do topete varrido pro lado
      [new THREE.SphereGeometry(r * 0.62, 18, 12), { p: [-r * 0.2, cy + r * 0.74, -r * 0.4], s: [1.4, 0.62, 0.85], r: [0.3, 0.1, -0.12] }],
      [new THREE.SphereGeometry(r * 0.5, 16, 10), { p: [r * 0.45, cy + r * 0.62, -r * 0.3], s: [1.0, 0.5, 0.9], r: [0.2, 0, 0.35] }],
      // costeletas
      [new THREE.CapsuleGeometry(r * 0.08, r * 0.28, 3, 8), { p: [-r * 0.92, cy + r * 0.05, -r * 0.2], r: [0, 0, 0.08] }],
      [new THREE.CapsuleGeometry(r * 0.08, r * 0.28, 3, 8), { p: [r * 0.92, cy + r * 0.05, -r * 0.2], r: [0, 0, -0.08] }],
    ]), mCabelo));
  } else {
    // capacete de moto aberto (cor P.bone) com viseira fumê levantada
    const mCap = vernizMat(P.bone);
    cabeca.add(malha(junta([
      [new THREE.SphereGeometry(r * 1.14, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), { p: [0, cy + 0.01, 0.03], r: [0.3, 0, 0] }],
      [new THREE.TorusGeometry(r * 1.12, r * 0.05, 6, 30), { p: [0, cy - r * 0.2, 0.08], r: [Math.PI / 2 + 0.3, 0, 0] }],
    ]), mCap));
    cabeca.add(malha(new THREE.SphereGeometry(r * 1.18, 22, 8, Math.PI * 0.72, Math.PI * 0.56, Math.PI * 0.18, Math.PI * 0.14),
      new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 }), { p: [0, cy, 0.02] }));
  }

  // =============== BRAÇOS (pivô no ombro, membro pende pra -y) ===============
  const manga = torno([
    [0, -0.4], [0.09, -0.4], [0.094, -0.3], [0.1, -0.15], [0.108, -0.02], [0.1, 0.045], [0.06, 0.08], [0, 0.085],
  ], 16);
  const punho = new THREE.CylinderGeometry(0.085, 0.082, 0.06, 14);
  const mao = geoMao(1.12);
  const braco = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0.41, 0);
    piv.add(malha(manga, mCasaco));
    piv.add(malha(punho, macacao ? mCasacoEsc : selecao ? mCasacoEsc : mCamisa, { p: [0, -0.42, 0] }));
    piv.add(malha(mao, mPele, { p: [0, -0.43, 0] }));
    tronco.add(piv); return piv;
  };
  const bracoE = braco(-0.4), bracoD = braco(0.4);

  if (P.pasta) {
    const mCouro = vernizMat(0x2b1d15);
    const pasta = new THREE.Group(); pasta.position.set(0, -0.62, -0.02); bracoE.add(pasta);
    pasta.add(malha(junta([
      [extruda(retRedondo(0.42, 0.3, 0.04), 0.08, 0.014), { p: [0, -0.2, 0], r: [0, Math.PI / 2, 0] }],
      [new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), { p: [0, -0.04, 0], r: [0, Math.PI / 2, 0] }],
    ]), mCouro));
    pasta.add(malha(junta([
      [new THREE.BoxGeometry(0.1, 0.03, 0.04), { p: [0, -0.08, -0.12] }],
      [new THREE.BoxGeometry(0.1, 0.03, 0.04), { p: [0, -0.08, 0.12] }],
    ]), metal(0xe0b12e, 0.3)));
  }

  // =============== PERNAS (pivô no quadril) ===============
  const calca = torno([
    [0, -0.78], [0.13, -0.78], [0.134, -0.7], [0.128, -0.5], [0.136, -0.2], [0.15, 0], [0.12, 0.07], [0, 0.08],
  ], 16);
  const pe = selecao ? geoTenis(0.92, 1.0) : geoSapato(0.92, 1.05);
  const barra = new THREE.TorusGeometry(0.13, 0.014, 5, 16);
  const perna = x => {
    const piv = new THREE.Group(); piv.position.set(x, 0, 0);
    piv.add(malha(calca, mCalca));
    piv.add(malha(barra, mCasacoEsc, { p: [0, -0.76, 0], r: [Math.PI / 2, 0, 0] }));
    piv.add(malha(pe.cab, mSapato));
    piv.add(malha(junta([[pe.sola.clone(), {}], [pe.det.clone(), {}]]), mSola));
    corpo.add(piv); return piv;
  };
  const pernaE = perna(-0.165), pernaD = perna(0.165);

  // ---- prancha e jato ----
  const { prancha, jato, chama } = criaPranchaJato(tronco, [0, 0.25, 0.4]);
  root.add(prancha);
  return { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama };
}
