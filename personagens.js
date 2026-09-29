/*
 * Nos Trilhos · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados.
 */
// Nos Trilhos — despachante de personagens. Cada turma tem seu próprio modelo:
//   personagens-surf.js   → Alex, Duda, Bento, Nina Neon (turma do Alex; grupo interno 'surf')
//   personagens-lula.js   → os visuais do Lula (Lula nos Trilhos)
//   personagens-flavio.js → os visuais do Flávio (Flávio nos Trilhos)
// criaCorredor(skin) escolhe o criador pelo campo skin.grupo ('surf' | 'lula' | 'flavio').
// criaVigia() vem do personagens-lula.js (segurança com braços com cotovelo).
// Todos retornam o mesmo formato: { root, corpo, tronco, cabeca, bracoE, bracoD, pernaE, pernaD, prancha, jato, chama }.
import { criaCorredor as corredorSurf } from './personagens-surf.js?v=1.0.5';
import { criaCorredor as corredorLula, criaVigia as vigiaLula } from './personagens-lula.js?v=1.0.5';
import { criaCorredor as corredorFlavio } from './personagens-flavio.js?v=1.0.5';

const CRIADORES = { surf: corredorSurf, lula: corredorLula, flavio: corredorFlavio };

export function criaCorredor(skin) {
  const cria = CRIADORES[skin && skin.grupo] || corredorLula;
  return cria(skin);
}
export function criaVigia() { return vigiaLula(); }
