<?php
/* Trilhos · Duelo Lula × Flávio · Desenvolvido por Alequizao <alequizao.dev@gmail.com>
 * https://github.com/alequizao · © 2026 Alequizao. Todos os direitos reservados. */
// Placar coletivo dos dois times (brincadeira de torcida, sem conteúdo político).
// GET  duelo.php  -> { ok, semana:{inicio, lula:{pontos,corridas}, flavio:{...}}, total:{lula:{...}, flavio:{...}} }
// POST duelo.php (JSON: time, pontos, moedas, dist) -> { ok, time, pontos, semana, total } | { ok:false, erro }
const PASTA_DADOS = '/www/wwwroot/alequizao.com/_dados';
const TIMES = ['lula', 'flavio'];
const LIMITE_ENVIOS = 30;      // corridas por IP...
const JANELA_SEG = 600;        // ...a cada 10 min
date_default_timezone_set('America/Maceio');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('CDN-Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function sai($dados, $cod = 200) { http_response_code($cod); echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function erro($msg, $cod = 400) { sai(['ok' => false, 'erro' => $msg], $cod); }

function banco() {
  if (!is_dir(PASTA_DADOS)) @mkdir(PASTA_DADOS, 0750, true);
  $db = new PDO('sqlite:' . PASTA_DADOS . '/ranking.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
  $db->exec('PRAGMA busy_timeout = 4000');
  $db->exec('PRAGMA journal_mode = WAL');
  $db->exec('CREATE TABLE IF NOT EXISTS duelo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL, pontos INTEGER NOT NULL, dist INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL, dia TEXT NOT NULL, ts INTEGER NOT NULL, ip_hash TEXT NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS ix_duelo_dia ON duelo(dia, time)');
  $db->exec('CREATE INDEX IF NOT EXISTS ix_duelo_ip ON duelo(ip_hash, ts)');
  return $db;
}

function ipHash() {
  $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '0');
  $arq = PASTA_DADOS . '/segredo.txt';
  $sal = @file_get_contents($arq);
  if (!$sal) { $sal = bin2hex(random_bytes(24)); @file_put_contents($arq, $sal); @chmod($arq, 0640); }
  return substr(hash_hmac('sha256', $ip, $sal), 0, 32);
}

// segunda-feira da semana atual (fuso de Maceió)
function inicioSemana() { return date('Y-m-d', strtotime('monday this week')); }

// semente: placar não começa vazio (uma base geral + uma pequena por semana, ~48/52 alternando o líder)
function semeia($db) {
  $seg = inicioSemana();
  $q = $db->prepare("SELECT COUNT(*) FROM duelo WHERE ip_hash = 'semente' AND dia >= ?");
  $q->execute([$seg]);
  if ((int)$q->fetchColumn() > 0) return;
  $ins = $db->prepare("INSERT INTO duelo (time, pontos, dist, data, dia, ts, ip_hash) VALUES (?, ?, 0, ?, ?, ?, 'semente')");
  $agora = time(); $data = gmdate('Y-m-d H:i:s');
  $db->beginTransaction();
  $geral = (int)$db->query("SELECT COUNT(*) FROM duelo WHERE ip_hash = 'semente'")->fetchColumn();
  if ($geral === 0) { // base histórica (antes desta semana)
    $antes = date('Y-m-d', strtotime($seg . ' -1 day'));
    $ins->execute(['lula', 96000, $data, $antes, $agora]);
    $ins->execute(['flavio', 104000, $data, $antes, $agora]);
  }
  $par = ((int)date('W')) % 2 === 0;
  $ins->execute(['lula', $par ? 24000 : 26000, $data, $seg, $agora]);
  $ins->execute(['flavio', $par ? 26000 : 24000, $data, $seg, $agora]);
  $db->commit();
}

function placar($db) {
  $seg = inicioSemana();
  $vazio = fn() => ['lula' => ['pontos' => 0, 'corridas' => 0], 'flavio' => ['pontos' => 0, 'corridas' => 0]];
  $semana = $vazio(); $total = $vazio();
  $sql = "SELECT time, SUM(pontos) p, SUM(CASE WHEN ip_hash = 'semente' THEN pontos / 800 ELSE 1 END) c FROM duelo %s GROUP BY time";
  $q = $db->prepare(sprintf($sql, 'WHERE dia >= ?')); $q->execute([$seg]);
  foreach ($q->fetchAll() as $r) if (isset($semana[$r['time']])) $semana[$r['time']] = ['pontos' => (int)$r['p'], 'corridas' => (int)$r['c']];
  foreach ($db->query(sprintf($sql, ''))->fetchAll() as $r) if (isset($total[$r['time']])) $total[$r['time']] = ['pontos' => (int)$r['p'], 'corridas' => (int)$r['c']];
  return ['semana' => ['inicio' => $seg] + $semana, 'total' => $total];
}

try {
  $db = banco();
  $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

  if ($metodo === 'GET') { semeia($db); sai(['ok' => true] + placar($db)); }
  if ($metodo !== 'POST') { header('Allow: GET, POST'); erro('Método não permitido.', 405); }

  $corpo = file_get_contents('php://input', false, null, 0, 2048);
  $d = json_decode($corpo ?: '', true);
  if (!is_array($d)) $d = $_POST;

  $time = is_string($d['time'] ?? null) ? $d['time'] : '';
  if (!in_array($time, TIMES, true)) erro('Time inválido.');
  foreach (['pontos', 'moedas', 'dist'] as $k) if (!isset($d[$k]) || !is_numeric($d[$k]) || $d[$k] < 0 || $d[$k] > 1e9) erro('Pontuação inválida.');
  $pontos = (int)floor($d['pontos']); $moedas = (int)floor($d['moedas']); $dist = (int)floor($d['dist']);
  // mesma plausibilidade do ranking.php
  if ($pontos < 1 || $dist < 1 || $dist > 2000000) erro('Pontuação inválida.');
  if ($moedas > $dist * 1.5 + 50) erro('Pontuação inválida.');
  if ($pontos > ($dist * 1.2 + $moedas * 5) * 30 * 1.1 + 100) erro('Pontuação inválida.');
  if ($pontos < $dist * 0.5 - 20) erro('Pontuação inválida.');

  $ip = ipHash();
  $agora = time();
  $q = $db->prepare('SELECT COUNT(*) FROM duelo WHERE ip_hash = ? AND ts >= ?');
  $q->execute([$ip, $agora - JANELA_SEG]);
  if ((int)$q->fetchColumn() >= LIMITE_ENVIOS) erro('Muitas corridas seguidas. Respira e volta daqui a pouco!', 429);

  $db->prepare('INSERT INTO duelo (time, pontos, dist, data, dia, ts, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ->execute([$time, $pontos, $dist, gmdate('Y-m-d H:i:s'), date('Y-m-d'), $agora, $ip]);
  semeia($db);
  sai(['ok' => true, 'time' => $time, 'pontos' => $pontos] + placar($db));
} catch (Throwable $e) {
  if (isset($db) && $db->inTransaction()) $db->rollBack();
  error_log('duelo.php: ' . $e->getMessage());
  erro('Duelo indisponível no momento.', 500);
}
