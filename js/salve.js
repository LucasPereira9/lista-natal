// Salve os Presentes! — minijogo de Natal
// O Rabugento (duende mal-humorado) quer roubar o saco de presentes. Arraste as luvas do Papai Noel
// para rebater o saco. A cada batida a barra diminui e o saco acelera. Caiu, ele leva tudo.
//
// Desempenho: personagens e fundo são pré-renderizados; física em passo fixo (1/120 s), igual em qualquer
// celular; área de jogo sempre com 400 de largura lógica.
import { isDev } from "./dev.js";

if (!isDev()) location.replace("./");

const $ = (s) => document.querySelector(s);
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
const cv = $("#cv");
const ctx = cv.getContext("2d", { alpha: false });
const INK = "#2b2a3a";

/* ---------------- regras ---------------- */
const W = 400, FLOOR = 560;
const LEFT = 26, RIGHT = W - 26, TOP = 110;    // paredes (bengalas doces) e varal de luzes (só um limite: com gravidade quase nunca chega lá)
const PAD_Y = 462, PAD_H = 16;                  // barra mais alta: o Rabugento fica no telhado, embaixo dela
const BALL_R = 15;
const DT = 1 / 120;
const padWidth = (hits) => Math.max(42, 96 - hits * 3);
// a partir da 15ª batida, algumas saem "com efeito" (curva) ou "curtas" (não sobem tudo)
const trickChance = (hits) => (hits < 15 ? 0 : hits < 25 ? 0.25 : hits < 35 ? 0.4 : 0.5);
// Física de "embaixadinha": o saco é lançado pra cima e a gravidade traz de volta.
// A gravidade aumenta a cada batida (sobe e cai mais rápido = ritmo mais acelerado).
const gravity = (hits) => Math.min(2600, 1250 + hits * 40);
const APEX = 255;                                    // altura normal do pulo acima das luvas
const sideSpeed = (hits) => Math.min(520, 330 + hits * 6); // velocidade lateral máxima (ponta da barra)
const ballSpeed = (hits) => Math.sqrt(2 * gravity(hits) * APEX); // usado nas estatísticas

/* ---------------- utilidades ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let scale = 1, k = 1, topExtra = 0, botExtra = 0, visH = 600, cssW = 400, cssH = 600;

function sprite(w, h, draw, pad = 6) {
  const c = document.createElement("canvas");
  c.width = Math.ceil((w + pad * 2) * k); c.height = Math.ceil((h + pad * 2) * k);
  const g = c.getContext("2d");
  g.scale(k, k); g.translate(pad, pad);
  g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = INK;
  draw(g);
  return { c, w, h, pad };
}
function stamp(s, x, y, w = s.w, h = s.h) {
  const fx = w / s.w, fy = h / s.h;
  ctx.drawImage(s.c, x - s.pad * fx, y - s.pad * fy, (s.w + s.pad * 2) * fx, (s.h + s.pad * 2) * fy);
}

/* ---------------- desenhos ---------------- */
let SPR = {};

// Rabugento: duende original, de chapéu roxo torto com sininho, narigão e sorriso maldoso.
// (desenhado com os pés em (40, 96) dentro de um quadro 80x100)
function drawRabugento(g, pose) {
  g.lineWidth = 3;
  // pernas e sapatos pontudos
  g.fillStyle = "#4a3426";
  g.beginPath(); g.rect(30, 78, 7, 16); g.fill(); g.stroke();
  g.beginPath(); g.rect(44, 78, 7, 16); g.fill(); g.stroke();
  g.fillStyle = "#ef4b4b";
  g.beginPath(); g.moveTo(24, 96); g.quadraticCurveTo(24, 88, 37, 90); g.lineTo(38, 96); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(43, 96); g.lineTo(44, 90); g.quadraticCurveTo(58, 88, 60, 82); g.quadraticCurveTo(60, 96, 43, 96); g.closePath(); g.fill(); g.stroke();
  // corpo (capa marrom com cinto)
  g.fillStyle = "#6b4a8f";
  g.beginPath(); g.moveTo(26, 82); g.quadraticCurveTo(24, 58, 40, 52); g.quadraticCurveTo(56, 58, 54, 82); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#2b2a3a"; g.fillRect(27, 70, 26, 4);
  g.fillStyle = "#ffd23f"; g.beginPath(); g.rect(37, 68, 6, 8); g.fill(); g.stroke();
  // braços
  g.strokeStyle = INK; g.lineWidth = 6;
  const arms = pose === "laugh" ? [[30, 62, 18, 70], [50, 62, 62, 70]] : pose === "grab" ? [[30, 62, 16, 52], [50, 62, 66, 52]] : [[30, 62, 36, 72], [50, 62, 44, 72]];
  for (const [x1, y1, x2, y2] of arms) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  g.strokeStyle = "#f2c7a5"; g.lineWidth = 3;
  for (const [x1, y1, x2, y2] of arms) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 2.5; g.fillStyle = "#f2c7a5";
  for (const [, , x2, y2] of arms) { g.beginPath(); g.arc(x2, y2, 4, 0, 7); g.fill(); g.stroke(); }
  g.lineWidth = 3;
  // cabeça e orelhas pontudas
  g.fillStyle = "#f2c7a5";
  g.beginPath(); g.moveTo(24, 38); g.lineTo(12, 30); g.lineTo(26, 44); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(56, 38); g.lineTo(68, 30); g.lineTo(54, 44); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(40, 40, 16, 0, 7); g.fill(); g.stroke();
  // sobrancelhona e olhos espertos
  g.fillStyle = INK;
  g.beginPath(); g.moveTo(28, 31); g.lineTo(39, 36); g.lineTo(39, 33); g.lineTo(29, 28); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(52, 31); g.lineTo(41, 36); g.lineTo(41, 33); g.lineTo(51, 28); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(34, 39, 2.6, pose === "laugh" ? 1.2 : 2.4, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(46, 39, 2.6, pose === "laugh" ? 1.2 : 2.4, 0, 0, 7); g.fill();
  // narigão
  g.fillStyle = "#e86a5a"; g.beginPath(); g.ellipse(40, 45, 5.5, 4.5, 0, 0, 7); g.fill(); g.stroke();
  // boca
  g.fillStyle = "#7a2a2a"; g.lineWidth = 2.5;
  if (pose === "laugh") {
    g.beginPath(); g.moveTo(31, 49); g.quadraticCurveTo(40, 62, 49, 49); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.fillRect(37, 49, 4, 3);
  } else {
    g.beginPath(); g.moveTo(31, 50); g.quadraticCurveTo(40, 56, 50, 49); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.rect(41, 51, 3.5, 3); g.fill();
  }
  g.lineWidth = 3;
  // chapéu roxo torto com faixa e sininho
  g.fillStyle = "#7b4bc4";
  g.beginPath(); g.moveTo(22, 30); g.quadraticCurveTo(30, 4, 54, 0); g.quadraticCurveTo(66, 0, 70, 10); g.quadraticCurveTo(56, 8, 50, 16); g.lineTo(58, 30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#ffd23f"; g.beginPath(); g.roundRect(20, 26, 40, 7, 3); g.fill(); g.stroke();
  g.beginPath(); g.arc(70, 13, 4.5, 0, 7); g.fill(); g.stroke();
}

function drawSack(g) {
  // saco de presentes redondo (40x46): saco vermelho com estrelinhas e laço dourado no alto
  g.lineWidth = 3;
  g.fillStyle = "#d9433b";
  g.beginPath(); g.arc(20, 26, 19, 0, 7); g.fill(); g.stroke();
  g.fillStyle = "#ef4b4b"; g.beginPath(); g.arc(14, 21, 7, 0, 7); g.fill();
  g.fillStyle = "#ffd23f";
  for (const [x, y] of [[26, 30], [12, 34], [22, 38]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  // boca amarrada
  g.fillStyle = "#d9433b";
  g.beginPath(); g.moveTo(13, 9); g.quadraticCurveTo(20, 2, 27, 9); g.lineTo(24, 12); g.lineTo(16, 12); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = "#ffd23f"; g.beginPath(); g.roundRect(13, 9, 14, 5, 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(20, 10); g.bezierCurveTo(10, 0, 6, 10, 20, 10); g.moveTo(20, 10); g.bezierCurveTo(30, 0, 34, 10, 20, 10); g.fill(); g.stroke();
}

function buildSprites() {
  SPR = {};
  SPR.rab = { idle: sprite(80, 100, (g) => drawRabugento(g, "idle")), laugh: sprite(80, 100, (g) => drawRabugento(g, "laugh")), grab: sprite(80, 100, (g) => drawRabugento(g, "grab")) };
  SPR.sack = sprite(40, 46, drawSack);
  SPR.glove = sprite(30, 30, (g) => { // luva branca do Papai Noel com punho vermelho
    g.lineWidth = 3;
    g.fillStyle = "#ef4b4b"; g.beginPath(); g.roundRect(-2, 9, 10, 14, 3); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.roundRect(6, 7, 6, 18, 3); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(11, 8); g.quadraticCurveTo(28, 2, 28, 15); g.quadraticCurveTo(28, 28, 11, 24); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(16, 8); g.quadraticCurveTo(14, -2, 22, 2); g.quadraticCurveTo(24, 6, 22, 9); g.stroke();
  });
  SPR.cane = sprite(18, 600, (g) => { // bengala doce (parede)
    g.save(); g.beginPath(); g.roundRect(2, 0, 14, 600, 7); g.clip();
    g.fillStyle = "#fff"; g.fillRect(0, 0, 18, 600);
    g.fillStyle = "#ef4b4b";
    for (let y = -20; y < 620; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(18, y - 12); g.lineTo(18, y); g.lineTo(0, y + 12); g.closePath(); g.fill(); }
    g.restore();
    g.lineWidth = 3; g.beginPath(); g.roundRect(2, 0, 14, 600, 7); g.stroke();
  });
  SPR.roof = sprite(400, 80, (g) => { // telhado nevado (chão)
    g.fillStyle = "#b8463e"; g.lineWidth = 3; g.fillRect(-10, 14, 420, 70);
    g.strokeStyle = "rgba(43,42,58,.25)"; g.lineWidth = 2;
    for (let y = 26; y < 80; y += 14) for (let x = (y / 14) % 2 ? 0 : 20; x < 410; x += 40) { g.beginPath(); g.arc(x, y, 20, 0, Math.PI); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 3;
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(-10, 22); for (let x = -10; x < 410; x += 50) g.quadraticCurveTo(x + 25, 2, x + 50, 22);
    g.lineTo(410, 30); for (let x = 410; x > -10; x -= 40) g.quadraticCurveTo(x - 20, 38, x - 40, 28); g.closePath(); g.fill(); g.stroke();
  }, 0);
  SPR.town = sprite(400, 120, (g) => { // cidadezinha de noite ao fundo
    const roofs = ["#2e9e5b", "#4fa8e8", "#a77bea", "#ff9f43"];
    let x = -10, i = 0;
    while (x < 400) {
      const w = 60 + (i * 31) % 34, h = 46 + (i * 19) % 40, base = 120, top = base - h;
      g.lineWidth = 2.5; g.fillStyle = "#3a4580"; g.beginPath(); g.rect(x + 5, top, w - 10, h); g.fill(); g.stroke();
      g.fillStyle = roofs[i % roofs.length]; g.beginPath(); g.moveTo(x, top + 2); g.lineTo(x + w / 2, top - 24); g.lineTo(x + w, top + 2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#ffd23f"; for (let wx = x + 14; wx < x + w - 18; wx += 18) { g.beginPath(); g.rect(wx, top + 10, 9, 10); g.fill(); }
      x += w + 6; i++;
    }
  });
}

/* ---------------- tela ---------------- */
function resize() {
  const vw = innerWidth, vh = innerHeight;
  cssH = vh; cssW = Math.min(vw, Math.round(vh * W / 600));
  scale = cssW / W;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  k = scale * dpr; visH = cssH / scale;
  const extra = Math.max(0, visH - 600);
  topExtra = extra * 0.5; botExtra = extra - topExtra;
  cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  $(".hud").style.width = cssW + "px";
  buildSprites();
}
// posição do dedo/mouse em coordenadas do jogo
function toGameX(clientX) { const r = cv.getBoundingClientRect(); return (clientX - r.left) / scale; }

/* ---------------- estado ---------------- */
const S = {
  mode: "menu", hits: 0, t: 0,
  pad: { x: W / 2, target: W / 2, squash: 0 },
  ball: { x: W / 2, y: PAD_Y - 60, vx: 0, vy: 0, rot: 0, squash: 0 },
  rab: { x: 52, y: FLOOR + 2, pose: "idle", say: "", sayT: 0, dir: 1, carry: false },
  pops: [], sparks: [], confetti: [], trail: [], snow: [], shake: 0, endT: 0, introT: 0, keys: { l: false, r: false },
};
const best = {
  get: () => { try { return +localStorage.getItem("natal.salve.best") || 0; } catch { return 0; } },
  set: (v) => { try { localStorage.setItem("natal.salve.best", String(v)); } catch {} },
};
function initDecor() { S.snow = Array.from({ length: 40 }, () => ({ x: rand(0, W), y: rand(-topExtra, 600 + botExtra), r: rand(1.2, 3), vy: rand(18, 45), vx: rand(-8, 8) })); }

function resetRun() {
  S.hits = 0; S.t = 0; S.pops = []; S.sparks = []; S.confetti = []; S.trail = []; S.shake = 0; S.endT = 0;
  S.pad.x = S.pad.target = W / 2; S.pad.squash = 0;
  Object.assign(S.ball, { x: W / 2, y: PAD_Y - 70, vx: 0, vy: 0, ax: 0, ay: 0, trick: "", rot: 0, squash: 0 });
  Object.assign(S.rab, { x: 52, y: FLOOR + 2, pose: "laugh", say: "Hehehe…", sayT: 1.6, dir: 1, carry: false, gone: 0 });
  setScore(0);
}

function launch(b, off, hits, apex) { // lança o saco pra cima a partir das luvas
  const g = gravity(hits);
  b.ay = g; b.ax = 0;
  b.vy = -Math.sqrt(2 * g * apex);
  b.vx = off * sideSpeed(hits);
}
function serve() { // primeiro toque: o saco sobe da luva
  launch(S.ball, rand(-0.3, 0.3), 0, APEX);
  S.mode = "play"; $("#hint").hidden = true;
}

/* ---------------- física ---------------- */
function step(dt) {
  if (S.mode === "lost") return stepLost(dt);
  S.t += dt;
  // luvas seguem o dedo (ou setas do teclado)
  if (S.keys.l || S.keys.r) S.pad.target = clamp(S.pad.target + (S.keys.r - S.keys.l) * 720 * dt, 0, W);
  const pw = padWidth(S.hits);
  S.pad.x = clamp(S.pad.target, LEFT + pw / 2 + 6, RIGHT - pw / 2 - 6);
  const b = S.ball;
  if (S.mode === "ready") { b.x = S.pad.x; b.y = PAD_Y - BALL_R - 2 + Math.sin(S.t * 5) * -6 - 4; return; }

  const px = b.x, py = b.y;
  b.vx += b.ax * dt; b.vy = Math.min(b.vy + b.ay * dt, 1800);
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.rot += (b.vx / 300) * dt * 6 + (b.trick ? dt * 18 : 0);
  // paredes e teto
  if (b.x - BALL_R < LEFT + 9) { b.x = LEFT + 9 + BALL_R; b.vx = Math.abs(b.vx); b.ax = Math.abs(b.ax); bump(b.x - BALL_R, b.y, 0.25); }
  if (b.x + BALL_R > RIGHT - 9) { b.x = RIGHT - 9 - BALL_R; b.vx = -Math.abs(b.vx); b.ax = -Math.abs(b.ax); bump(b.x + BALL_R, b.y, 0.25); }
  if (b.y - BALL_R < TOP) { b.y = TOP + BALL_R; b.vy = Math.abs(b.vy); bump(b.x, b.y - BALL_R, 0.25); }
  // luvas: só quando está descendo e cruza o topo da barra
  const half = pw / 2 + 14; // inclui as luvas nas pontas
  if (b.vy > 0 && py + BALL_R <= PAD_Y + 4 && b.y + BALL_R >= PAD_Y && Math.abs(b.x - S.pad.x) <= half + BALL_R * 0.5) {
    S.hits++;
    let off = clamp((b.x - S.pad.x) / half, -1, 1);
    let apex = APEX * rand(0.92, 1.05);
    b.trick = "";
    const trick = Math.random() < trickChance(S.hits) ? (Math.random() < 0.5 ? "curve" : "short") : "";
    if (trick) off = clamp(off + rand(-0.35, 0.35), -1, 1); // direção menos previsível
    if (trick === "short") apex *= rand(0.45, 0.62);          // 💨 curta: sobe pouco e já volta
    launch(b, off, S.hits, apex);
    if (trick === "curve") b.ax = (off >= 0 ? -1 : 1) * rand(420, 650); // 🌀 curva pro lado contrário
    b.trick = trick;
    b.y = PAD_Y - BALL_R; b.squash = 1; S.pad.squash = 1;
    setScore(S.hits);
    S.pops.push({ x: b.x, y: b.y - 30, txt: b.trick === "curve" ? "🌀 +1" : b.trick === "short" ? "💨 +1" : "+1", t: 0, size: 20, color: b.trick ? "#ffd23f" : "#fff" });
    sparkle(b.x, PAD_Y, "#ffffff", 7);
    if (S.hits % 10 === 0) celebrate();
    else if (Math.random() < 0.18) say("Grrr!", 0.9, "idle");
    try { navigator.vibrate?.(12); } catch {}
  }
  // rastro quando está rápido
  if (S.hits >= 8) { S.trail.push({ x: b.x, y: b.y, t: 0 }); if (S.trail.length > 10) S.trail.shift(); }
  // o Rabugento esfrega as mãos quando o saco desce
  if (!S.rab.sayT) S.rab.pose = b.vy > 0 && b.y > 340 ? "laugh" : "idle";
  // caiu!
  if (b.y - BALL_R > PAD_Y + 40) lose();
}

function bump(x, y, s) { S.shake = Math.max(S.shake, s * 0.12); sparkle(x, y, "#ffd23f", 4); }
function say(txt, t, pose) { S.rab.say = txt; S.rab.sayT = t; if (pose) S.rab.pose = pose; }
function celebrate() {
  S.pops.push({ x: W / 2, y: TOP + 110, txt: S.hits + "! 🎉", t: 0, size: 40, color: "#ffd23f", big: true });
  for (let i = 0; i < 36; i++) S.confetti.push({ x: rand(LEFT, RIGHT), y: rand(-20, 80), vx: rand(-40, 40), vy: rand(60, 160), r: rand(0, 6), vr: rand(-6, 6), c: ["#ef4b4b", "#ffd23f", "#2e9e5b", "#4fa8e8", "#a77bea"][i % 5], t: 0 });
  say("Grrrr!!", 1.1, "idle");
}
function sparkle(x, y, color, n) {
  for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0), sp = rand(60, 170); S.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1.8, 3.6), t: 0, life: rand(0.35, 0.6), c: color }); }
}

/* ---------------- o Rabugento leva o saco ---------------- */
function lose() {
  S.mode = "lost"; S.endT = 0; S.shake = 0.4;
  S.ball.vx *= 0.3; S.ball.vy = Math.min(S.ball.vy, 420);
  say("Hehehe!", 2.2, "laugh");
  try { navigator.vibrate?.([60, 60, 120]); } catch {}
  $("#hud").hidden = true;
}
function stepLost(dt) {
  S.endT += dt;
  const b = S.ball, r = S.rab;
  if (!r.carry) {
    // saco cai no telhado e quica
    b.vy += 1400 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y + BALL_R > FLOOR + 10) { b.y = FLOOR + 10 - BALL_R; b.vy = -Math.abs(b.vy) * 0.35; b.vx *= 0.7; }
    // Rabugento corre até o saco
    const dx = b.x - r.x; r.dir = dx >= 0 ? 1 : -1;
    r.x += clamp(dx, -320 * dt, 320 * dt); r.pose = "laugh";
    if (Math.abs(dx) < 10 && S.endT > 0.45) { r.carry = true; r.pose = "grab"; say("É MEU!", 1.4, "grab"); }
  } else {
    // foge com o saco na cabeça
    r.dir = r.x < W / 2 ? -1 : 1;
    r.x += r.dir * 230 * dt;
    b.x = r.x - r.dir * 3; b.y = r.y - 78 + Math.abs(Math.sin(S.endT * 14)) * -4; b.rot = Math.sin(S.endT * 10) * 0.3;
    if (r.x < -90 || r.x > W + 90 || S.endT > 5) { r.gone = (r.gone || 0) + dt; if (r.gone > 0.35) gameOver(); }
  }
}

/* ---------------- desenho ---------------- */
function draw() {
  const sx = S.shake > 0 ? rand(-1, 1) * 8 * S.shake : 0, sy = S.shake > 0 ? rand(-1, 1) * 8 * S.shake : 0;
  ctx.setTransform(k, 0, 0, k, sx * k, (topExtra + sy) * k);
  // céu de noite
  const grd = ctx.createLinearGradient(0, -topExtra, 0, FLOOR);
  grd.addColorStop(0, "#1f2d63"); grd.addColorStop(1, "#5a6db3");
  ctx.fillStyle = grd; ctx.fillRect(-10, -topExtra - 10, W + 20, visH + 20);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  for (let i = 0; i < 46; i++) ctx.fillRect((i * 89 + 17) % W, ((i * 61) % 420) - topExtra * 0.6, 2, 2);
  ctx.fillStyle = "#fff8d6"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(306, 196, 30, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(43,42,58,.12)"; ctx.beginPath(); ctx.arc(296, 188, 6, 0, 7); ctx.arc(314, 206, 4, 0, 7); ctx.fill();
  stamp(SPR.town, 0, FLOOR - 120);

  // varal de luzes no teto
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, TOP - 14);
  for (let x = 0; x <= W; x += 50) ctx.quadraticCurveTo(x + 25, TOP - 2, x + 50, TOP - 14);
  ctx.stroke();
  const colors = ["#ef4b4b", "#ffd23f", "#2e9e5b", "#4fa8e8"];
  for (let x = 12, i = 0; x < W; x += 25, i++) {
    const y = TOP - 14 + Math.sin(((x % 50) / 50) * Math.PI) * 8 + 6;
    const on = (Math.floor(S.t * 3) + i) % 4 !== 0;
    ctx.fillStyle = on ? colors[i % 4] : "#555"; ctx.beginPath(); ctx.ellipse(x, y, 5, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
  }
  // bengalas doces nas laterais
  stamp(SPR.cane, LEFT - 9, TOP - 30, 18, FLOOR - TOP + 40);
  stamp(SPR.cane, RIGHT - 9, TOP - 30, 18, FLOOR - TOP + 40);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = "#fff";
  // ganchos das bengalas (curvados para dentro)
  const hooks = [[LEFT + 14, Math.PI, 2 * Math.PI, false], [RIGHT - 14, 0, Math.PI, true]];
  for (const [cx, a0, a1, ccw] of hooks) {
    ctx.lineWidth = 17; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(cx, TOP - 30, 14, a0, a1, ccw); ctx.stroke();
    ctx.lineWidth = 11; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, TOP - 30, 14, a0, a1, ccw); ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;

  // telhado
  stamp(SPR.roof, 0, FLOOR - 14);
  if (botExtra > 0) { ctx.fillStyle = "#b8463e"; ctx.fillRect(-10, FLOOR + 66, W + 20, botExtra + 40); }

  // rastro do saco
  for (const p of S.trail) { const a = 1 - p.t / 0.18; if (a <= 0) continue; ctx.globalAlpha = a * 0.35; ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * a, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;

  // Rabugento
  drawRab();

  // luvas + bengala (raquete)
  if (S.mode !== "lost") drawPaddle();

  // saco de presentes
  const b = S.ball, sq = b.squash;
  if (b.trick && S.mode === "play") {
    ctx.globalAlpha = 0.55 + Math.sin(S.t * 30) * 0.25;
    ctx.strokeStyle = b.trick === "curve" ? "#c19cf2" : "#7cd6ff"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R + 7, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
  ctx.scale(1 + sq * 0.18, 1 - sq * 0.18);
  stamp(SPR.sack, -16, -20, 32, 37);
  ctx.restore();

  // faíscas, confete, textos
  for (const p of S.sparks) { const a = 1 - p.t / p.life; if (a <= 0) continue; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  for (const c of S.confetti) { ctx.globalAlpha = Math.max(0, 1 - c.t / 1.8); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  for (const p of S.pops) {
    const life = p.big ? 1.2 : 0.7, a = 1 - p.t / life; if (a <= 0) continue;
    const sc = p.big ? 1 + Math.max(0, 0.2 - p.t) * 2.5 : 1;
    ctx.globalAlpha = a; ctx.font = `700 ${Math.round(p.size * sc)}px Fredoka, sans-serif`;
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.fillStyle = p.color;
    ctx.strokeText(p.txt, p.x, p.y - p.t * 36); ctx.fillText(p.txt, p.x, p.y - p.t * 36);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath();
  for (const f of S.snow) { ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, 7); }
  ctx.fill();
}

function drawPaddle() {
  const pw = padWidth(S.hits), x = S.pad.x, y = PAD_Y, sq = S.pad.squash;
  ctx.save(); ctx.translate(x, y + sq * 3); ctx.scale(1 + sq * 0.05, 1 - sq * 0.2);
  // barra listrada (bengala doce)
  ctx.save(); ctx.beginPath(); ctx.roundRect(-pw / 2, 0, pw, PAD_H, 8); ctx.clip();
  ctx.fillStyle = "#fff"; ctx.fillRect(-pw / 2, 0, pw, PAD_H);
  ctx.fillStyle = "#ef4b4b";
  for (let sx = -pw / 2 - 20; sx < pw / 2 + 20; sx += 18) { ctx.beginPath(); ctx.moveTo(sx, PAD_H); ctx.lineTo(sx + 9, 0); ctx.lineTo(sx + 17, 0); ctx.lineTo(sx + 8, PAD_H); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-pw / 2, 0, pw, PAD_H, 8); ctx.stroke();
  // luvas segurando as pontas
  stamp(SPR.glove, -pw / 2 - 22, -7, 30, 30);
  ctx.save(); ctx.scale(-1, 1); stamp(SPR.glove, -pw / 2 - 22, -7, 30, 30); ctx.restore();
  ctx.restore();
}

function drawRab() {
  const r = S.rab;
  const bob = r.pose === "laugh" ? Math.abs(Math.sin(S.t * 14 + S.endT * 14)) * -5 : Math.sin(S.t * 3) * 2;
  ctx.save(); ctx.translate(r.x, r.y + bob); ctx.scale(r.dir * 0.66, 0.66);
  stamp(SPR.rab[r.pose] || SPR.rab.idle, -40, -96);
  ctx.restore();
  if (r.say && r.sayT > 0) {
    const bx = clamp(r.x + 58, 70, W - 70), by = r.y - (r.carry ? 118 : 84); // carregando: balão acima do saco
    ctx.font = "700 17px Fredoka, sans-serif"; ctx.textAlign = "center";
    const w = ctx.measureText(r.say).width + 22;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx - w / 2, by - 18, w, 30, 14); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - w / 2 + 14, by + 12); ctx.lineTo(bx - w / 2 + 6, by + 22); ctx.lineTo(bx - w / 2 + 24, by + 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(r.say, bx, by + 3);
  }
}

/* ---------------- animações (não afetam pontuação) ---------------- */
function animate(dt) {
  if (S.mode === "menu" || S.mode === "over" || S.mode === "ready") S.t += S.mode === "ready" ? 0 : dt;
  S.ball.squash = Math.max(0, S.ball.squash - dt * 6); S.pad.squash = Math.max(0, S.pad.squash - dt * 7);
  S.shake = Math.max(0, S.shake - dt);
  if (S.rab.sayT > 0) { S.rab.sayT = Math.max(0, S.rab.sayT - dt); if (!S.rab.sayT) S.rab.say = ""; }
  for (const p of S.trail) p.t += dt; S.trail = S.trail.filter((p) => p.t < 0.18);
  for (const p of S.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }
  S.sparks = S.sparks.filter((p) => p.t < p.life);
  for (const c of S.confetti) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
  S.confetti = S.confetti.filter((c) => c.t < 1.8);
  for (const p of S.pops) p.t += dt; S.pops = S.pops.filter((p) => p.t < (p.big ? 1.2 : 0.7));
  for (const f of S.snow) { f.y += f.vy * dt; f.x += f.vx * dt; if (f.y > 600 + botExtra) { f.y = -topExtra - 5; f.x = rand(0, W); } }
  if (S.mode === "menu" || S.mode === "over") { // no menu o Rabugento fica rindo lá embaixo
    S.rab.pose = "laugh"; S.rab.x = 52; S.rab.dir = 1; S.rab.carry = false;
  }
}

/* ---------------- placar e telas ---------------- */
const scoreEl = $("#score"), pill = $(".score-pill");
function setScore(v) { scoreEl.textContent = v; if (v) { pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); } }
function show(id) { ["#startPanel", "#overPanel", "#pausePanel"].forEach((p) => ($(p).hidden = p !== id)); }
function toMenu() {
  S.mode = "menu"; resetRun(); S.rab.say = ""; S.rab.sayT = 0;
  $("#hud").hidden = true; $("#hint").hidden = true;
  const b = best.get(); $("#bestStart").hidden = !b; $("#bestStart b").textContent = b;
  show("#startPanel");
}
function toReady() { resetRun(); S.mode = "ready"; show(null); $("#hud").hidden = false; $("#hint").hidden = false; }
function gameOver() {
  S.mode = "over";
  const b = best.get(), rec = S.hits > b;
  if (rec) best.set(S.hits);
  $("#finalScore").textContent = S.hits;
  $("#stats").innerHTML = `
    <li><span>🧤 Batidas</span><b>${S.hits}</b></li>
    <li><span>⏱️ Tempo protegendo</span><b>${Math.floor(S.t)}s</b></li>
    <li><span>🚀 Velocidade final</span><b>${Math.round((ballSpeed(S.hits) / ballSpeed(0)) * 100)}%</b></li>`;
  $("#newRecord").hidden = !rec;
  $("#bestOver").innerHTML = `Recorde no treino: <b>${Math.max(b, S.hits)}</b>`;
  show("#overPanel");
}
function pause() { if (S.mode !== "play" && S.mode !== "ready") return; S.prevMode = S.mode; S.mode = "paused"; show("#pausePanel"); $("#hint").hidden = true; }
function resume() { S.mode = S.prevMode || "play"; show(null); if (S.mode === "ready") $("#hint").hidden = false; last = performance.now(); acc = 0; }

/* ---------------- controles ---------------- */
let dragging = false;
cv.addEventListener("pointerdown", (e) => {
  e.preventDefault(); dragging = true;
  try { cv.setPointerCapture(e.pointerId); } catch {}
  S.pad.target = toGameX(e.clientX);
  if (S.mode === "ready") serve();
});
cv.addEventListener("pointermove", (e) => { if (dragging || e.pointerType === "mouse") S.pad.target = toGameX(e.clientX); });
addEventListener("pointerup", () => (dragging = false));
addEventListener("pointercancel", () => (dragging = false));
addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") S.keys.l = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") S.keys.r = true;
  if ((e.code === "Space" || e.code === "ArrowUp") && S.mode === "ready") { e.preventDefault(); serve(); }
  if (e.code === "Escape" || e.code === "KeyP") (S.mode === "paused" ? resume() : pause());
});
addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") S.keys.l = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") S.keys.r = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
$("#trainBtn").addEventListener("click", toReady);
$("#againBtn").addEventListener("click", toReady);
$("#menuBtn").addEventListener("click", toMenu);
$("#quitBtn").addEventListener("click", toMenu);
$("#pauseBtn").addEventListener("click", (e) => { e.stopPropagation(); pause(); });
$("#resumeBtn").addEventListener("click", resume);
addEventListener("resize", resize);

/* ---------------- laço ---------------- */
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  if (S.mode === "play" || S.mode === "ready" || S.mode === "lost") {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; if (S.mode === "over") break; }
  }
  if (S.mode !== "paused") animate(dt);
  draw();
  requestAnimationFrame(frame);
}

(async function main() {
  resize(); initDecor();
  try { await document.fonts.ready; } catch {}
  toMenu();
  requestAnimationFrame((t) => { last = t; frame(t); });
  // ganchos para os testes automáticos (só leitura)
  window.__salve = { get state() { const b = S.ball; return { mode: S.mode, hits: S.hits, t: S.t, ball: { x: b.x, y: b.y, vx: b.vx, vy: b.vy, ax: b.ax, ay: b.ay, trick: b.trick }, pad: { x: S.pad.x, w: padWidth(S.hits) }, speed: ballSpeed(S.hits) }; },
    consts: { PAD_Y, BALL_R, LEFT, RIGHT, TOP } };
})();
