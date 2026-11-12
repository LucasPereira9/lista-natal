// Trenó nas Nuvens — minijogo de Natal
// Segure para subir, solte para descer. Desvie das chaminés (embaixo) e do gelo (em cima).
//
// Desempenho: tudo que é desenho (trenó, chaminé, gelo, casas, montanhas…) é pré-renderizado
// uma vez em canvas fora da tela e só "carimbado" a cada quadro.
// Justiça: a física roda em passo fixo (1/120 s), então o jogo é igual em celular de 60 ou 120 Hz,
// e a área de jogo tem sempre 400 de largura lógica (ninguém enxerga mais à frente que os outros).
import { SANTA_SVG } from "./santa.js";
import { isDev } from "./dev.js";

if (!isDev()) location.replace("./");

const $ = (s) => document.querySelector(s);
// celulares antigos não têm roundRect no canvas: usa retângulo comum
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
const cv = $("#cv");
const ctx = cv.getContext("2d", { alpha: false });
const INK = "#2b2a3a";

/* ---------------- mundo (unidades lógicas) ---------------- */
const W = 400;            // largura lógica fixa
const GROUND = 560;       // chão de neve
const CEIL = 30;          // borda de baixo da faixa de nuvens do topo
const SX = 110;           // posição x do trenó
const CW = 74;            // largura das colunas (chaminé / gelo)
const DT = 1 / 120;       // passo fixo da física
const G = 1600, THRUST = 2050, VMAX_UP = -430, VMAX_DOWN = 500; // resposta rápida ao dedo, sem ficar nervoso
const SLEIGH_W = 116, SLEIGH_H = 58;
// círculos de colisão do trenó (relativos ao centro), um pouco menores que o desenho: colisão justa
const HITS = [{ x: -30, y: 12, r: 13 }, { x: -12, y: -6, r: 12 }, { x: 8, y: 14, r: 12 }, { x: 36, y: 2, r: 10 }];

let scale = 1, k = 1, topExtra = 0, botExtra = 0, visH = 600, cssW = 400, cssH = 600;

/* ---------------- utilidades ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`; };

function sprite(w, h, draw, pad = 6) {
  const c = document.createElement("canvas");
  c.width = Math.ceil((w + pad * 2) * k); c.height = Math.ceil((h + pad * 2) * k);
  const g = c.getContext("2d");
  g.scale(k, k); g.translate(pad, pad);
  g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = INK;
  draw(g);
  return { c, w, h, pad };
}
// desenha um sprite (ou só uma faixa vertical dele: sy/sh em unidades lógicas)
function stamp(s, x, y, w = s.w, h = s.h, sy = 0, sh = s.h) {
  const p = s.pad;
  ctx.drawImage(s.c, 0, (sy) * k, s.c.width, (sh + p * 2) * k, x - p * (w / s.w), y - p * (h / sh), w + p * 2 * (w / s.w), h + p * 2 * (h / sh));
}

/* ---------------- desenhos ---------------- */
let SPR = {};
let santaImg = null;

function loadSanta() {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SANTA_SVG.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}

function buildSprites() {
  SPR = {};
  // trenó
  SPR.sleigh = sprite(SLEIGH_W, SLEIGH_H, (g) => { if (santaImg) g.drawImage(santaImg, 0, 0, SLEIGH_W, SLEIGH_H); }, 4);

  // chaminé alta (desenhada de cima para baixo; usamos só o pedaço necessário)
  SPR.chimney = sprite(CW, 640, (g) => {
    g.fillStyle = "#c8463e"; g.lineWidth = 3;
    g.beginPath(); g.rect(4, 20, CW - 8, 640); g.fill(); g.stroke();
    g.strokeStyle = "rgba(43,42,58,.22)"; g.lineWidth = 2;
    for (let y = 36, row = 0; y < 640; y += 16, row++) {
      g.beginPath(); g.moveTo(6, y); g.lineTo(CW - 6, y); g.stroke();
      for (let x = (row % 2 ? 18 : 30); x < CW - 8; x += 26) { g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x, y); g.stroke(); }
    }
    g.strokeStyle = INK; g.lineWidth = 3;
    g.fillStyle = "#a8352f"; g.beginPath(); g.rect(-4, 10, CW + 8, 18); g.fill(); g.stroke();
    // neve em cima
    g.fillStyle = "#fff"; g.beginPath();
    g.moveTo(-6, 14); g.quadraticCurveTo(4, -2, 18, 6); g.quadraticCurveTo(30, -6, 44, 4);
    g.quadraticCurveTo(58, -4, CW + 6, 10); g.quadraticCurveTo(CW + 8, 18, CW - 2, 18);
    g.quadraticCurveTo(CW - 12, 24, CW - 18, 18); g.quadraticCurveTo(30, 26, 14, 18); g.quadraticCurveTo(-4, 22, -6, 14);
    g.fill(); g.stroke();
  });

  // coluna de gelo (pendurada; usamos só a parte de baixo, com a ponta)
  SPR.ice = sprite(CW, 640, (g) => {
    const grd = g.createLinearGradient(0, 0, CW, 0);
    grd.addColorStop(0, "#bfe8ff"); grd.addColorStop(.5, "#e9f8ff"); grd.addColorStop(1, "#9fd6f7");
    g.fillStyle = grd; g.lineWidth = 3;
    g.beginPath(); g.moveTo(6, 0); g.lineTo(6, 600);
    const tips = [[6, 600], [16, 628], [24, 606], [36, 638], [48, 606], [58, 624], [CW - 6, 600]];
    tips.forEach(([x, y]) => g.lineTo(x, y));
    g.lineTo(CW - 6, 0); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(18, 0); g.lineTo(18, 590); g.stroke();
    g.strokeStyle = "rgba(43,42,58,.15)"; g.lineWidth = 2;
    for (let y = 40; y < 590; y += 54) { g.beginPath(); g.moveTo(30, y); g.lineTo(44, y + 14); g.stroke(); }
  });

  // estrela e presente
  SPR.star = sprite(30, 30, (g) => {
    g.fillStyle = "#ffd23f"; g.lineWidth = 2.6; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6.5 : 14.5; g.lineTo(15 + Math.cos(a) * r, 15 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(11, 11, 2.4, 0, 7); g.fill();
  });
  SPR.gift = sprite(32, 32, (g) => {
    g.lineWidth = 2.6;
    g.fillStyle = "#ef4b4b"; g.beginPath(); g.roundRect(3, 11, 26, 19, 3); g.fill(); g.stroke();
    g.fillStyle = "#ff6b6b"; g.beginPath(); g.roundRect(1, 6, 30, 8, 3); g.fill(); g.stroke();
    g.fillStyle = "#ffd23f"; g.beginPath(); g.rect(13, 6, 6, 24); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(16, 6); g.bezierCurveTo(8, -4, 2, 4, 16, 6); g.moveTo(16, 6); g.bezierCurveTo(24, -4, 30, 4, 16, 6); g.fill(); g.stroke();
  });

  // passarinho (2 quadros: asa pra cima / pra baixo)
  const bird = (up) => (g) => {
    g.lineWidth = 2.6;
    g.fillStyle = "#4f7fd6"; g.beginPath(); g.ellipse(18, 15, 13, 10, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#ffd23f"; g.beginPath(); g.moveTo(5, 14); g.lineTo(-2, 17); g.lineTo(5, 19); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(11, 11, 3.6, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(10.4, 11, 1.4, 0, 7); g.fill();
    g.fillStyle = "#ef4b4b"; g.beginPath(); g.moveTo(16, 6); g.lineTo(22, 1); g.lineTo(24, 7); g.closePath(); g.fill(); g.stroke(); // gorrinho
    g.fillStyle = "#7aa6ef"; g.beginPath();
    if (up) { g.moveTo(16, 13); g.quadraticCurveTo(24, -4, 32, 6); g.quadraticCurveTo(28, 14, 16, 13); }
    else { g.moveTo(16, 15); g.quadraticCurveTo(26, 30, 33, 22); g.quadraticCurveTo(28, 14, 16, 15); }
    g.fill(); g.stroke();
  };
  SPR.bird = [sprite(36, 30, bird(true)), sprite(36, 30, bird(false))];

  // nuvem decorativa
  SPR.cloud = sprite(150, 64, (g) => {
    g.fillStyle = "rgba(255,255,255,.92)"; g.lineWidth = 3; g.beginPath();
    g.moveTo(14, 56); g.quadraticCurveTo(-6, 54, 6, 38); g.quadraticCurveTo(4, 18, 30, 24);
    g.quadraticCurveTo(42, 0, 70, 12); g.quadraticCurveTo(96, -2, 108, 22); g.quadraticCurveTo(140, 16, 140, 40);
    g.quadraticCurveTo(152, 58, 132, 58); g.closePath(); g.fill(); g.stroke();
  });

  // faixa de nuvens do teto (repete na horizontal)
  SPR.ceil = sprite(400, 70, (g) => {
    g.fillStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -400); g.lineTo(-10, 40);
    for (let x = -10; x < 410; x += 50) g.quadraticCurveTo(x + 25, 66, x + 50, 40);
    g.lineTo(410, -400); g.closePath(); g.fill(); g.stroke();
  }, 0);

  // montanhas ao fundo (repete)
  SPR.mount = sprite(800, 230, (g) => {
    const peaks = [[0, 150], [90, 40], [190, 130], [300, 20], [420, 120], [520, 50], [640, 140], [720, 70], [800, 150]];
    g.fillStyle = "#e6f3fb"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 230);
    peaks.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(800, 230); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff"; // neve nos picos
    [[90, 40], [300, 20], [520, 50], [720, 70]].forEach(([x, y]) => {
      g.beginPath(); g.moveTo(x - 26, y + 34); g.lineTo(x, y); g.lineTo(x + 28, y + 36); g.lineTo(x + 12, y + 28); g.lineTo(x, y + 38); g.lineTo(x - 12, y + 28); g.closePath(); g.fill(); g.stroke();
    });
  });

  // vilarejo com casinhas iluminadas (repete)
  SPR.town = sprite(900, 140, (g) => {
    const colors = ["#2e9e5b", "#4fa8e8", "#ef4b4b", "#a77bea", "#ffb347"];
    let x = 0, i = 0;
    while (x < 900) {
      const w = 70 + (i * 37) % 40, h = 50 + (i * 23) % 36, base = 140, top = base - h;
      g.lineWidth = 3;
      g.fillStyle = "#fff6e6"; g.beginPath(); g.rect(x + 6, top, w - 12, h); g.fill(); g.stroke();
      g.fillStyle = colors[i % colors.length]; g.beginPath(); g.moveTo(x, top + 2); g.lineTo(x + w / 2, top - 30); g.lineTo(x + w, top + 2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x - 2, top + 2); g.lineTo(x + w / 2, top - 30); g.lineTo(x + w + 2, top + 2); g.lineTo(x + w - 10, top - 4); g.lineTo(x + w / 2, top - 22); g.lineTo(x + 10, top - 4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#ffd23f";
      for (let wx = x + 16; wx < x + w - 22; wx += 22) { g.beginPath(); g.rect(wx, top + 12, 12, 13); g.fill(); g.stroke(); }
      g.fillStyle = "#8a5a33"; g.beginPath(); g.rect(x + w / 2 - 7, base - 20, 14, 20); g.fill(); g.stroke();
      x += w + 14 + (i * 13) % 20; i++;
    }
  }, 4);

  // chão de neve (repete)
  SPR.ground = sprite(400, 80, (g) => {
    g.fillStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, 400); g.lineTo(-10, 8);
    for (let x = -10; x < 410; x += 80) g.quadraticCurveTo(x + 40, -6, x + 80, 8);
    g.lineTo(410, 400); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "rgba(111,195,247,.25)";
    for (let x = 20; x < 400; x += 70) { g.beginPath(); g.ellipse(x, 40, 24, 5, 0, 0, 7); g.fill(); }
  }, 0);
}

/* ---------------- tamanho da tela ---------------- */
function resize() {
  const vw = innerWidth, vh = innerHeight;
  cssH = vh; cssW = Math.min(vw, Math.round(vh * W / 600)); // nunca mais largo que 400x600 (justo)
  scale = cssW / W;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  k = scale * dpr;
  visH = cssH / scale;
  const extra = Math.max(0, visH - 600);
  topExtra = extra * 0.45; botExtra = extra - topExtra;
  cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  document.querySelector(".hud").style.width = cssW + "px";
  buildSprites();
}

/* ---------------- estado do jogo ---------------- */
const S = {
  mode: "menu", t: 0, score: 0, y: 260, vy: 0, rot: 0, holding: false,
  cols: [], items: [], birds: [], pops: [], trail: [], snow: [], clouds: [],
  scroll: 0, speed: 0, lastC: 300, dieT: 0, shake: 0, why: "", nextSpeedUp: 20, trailT: 0, banner: null,
};
const best = { get: () => { try { return +localStorage.getItem("natal.treino.best") || 0; } catch { return 0; } },
  set: (v) => { try { localStorage.setItem("natal.treino.best", String(v)); } catch {} } };

function initDecor() {
  S.snow = Array.from({ length: 46 }, () => ({ x: rand(0, W), y: rand(-topExtra, 600 + botExtra), r: rand(1.2, 3.2), vy: rand(22, 55), vx: rand(-10, 10) }));
  S.clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 130 + rand(0, 60), y: rand(70, 260), s: rand(.55, .9) }));
}

const diff = (t) => ({
  speed: Math.min(230 + t * 5.5, 430),
  gap: Math.max(172, 268 - t * 1.7),
  spacing: Math.max(232, 330 - t * 1.6),
});

function resetRun() {
  Object.assign(S, { t: 0, score: 0, y: 270, vy: 0, rot: 0, cols: [], items: [], birds: [], pops: [], trail: [], lastC: 300, dieT: 0, shake: 0, why: "", nextSpeedUp: 20, trailT: 0, banner: null });
  S.speed = diff(0).speed;
  setScore(0);
}

function spawnCol(x) {
  const d = diff(S.t);
  const minC = CEIL + 18 + d.gap / 2, maxC = GROUND - 22 - d.gap / 2;
  const c = clamp(S.lastC + rand(-1, 1) * 150, minC, maxC);
  S.lastC = c;
  const col = { x, top: c - d.gap / 2, bot: c + d.gap / 2, passed: false };
  S.cols.push(col);
  // estrela dentro do vão (comum)
  if (Math.random() < 0.55) S.items.push({ kind: "star", x: x + CW / 2, y: c + rand(-d.gap * 0.22, d.gap * 0.22), got: false, ph: rand(0, 6) });
  // entre esta coluna e a próxima: presente raro ou passarinho (depois de 35 s)
  const midX = x + CW + d.spacing / 2 - CW / 2;
  if (S.t > 35 && Math.random() < 0.32) {
    S.birds.push({ x: midX, base: clamp(c + rand(-60, 60), CEIL + 70, GROUND - 70), amp: rand(40, 75), ph: rand(0, 6), sp: rand(2.2, 3.2) });
  } else if (Math.random() < 0.14) {
    S.items.push({ kind: "gift", x: midX, y: clamp(c + rand(-130, 130), CEIL + 40, GROUND - 40), got: false, ph: rand(0, 6) });
  }
}

/* ---------------- física (passo fixo) ---------------- */
function circleRect(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}
function hitTest() {
  for (const h of HITS) {
    const cx = SX + h.x, cy = S.y + h.y;
    if (cy + h.r > GROUND + 4) return "Caiu na neve!";
    for (const c of S.cols) {
      if (c.x > cx + h.r || c.x + CW < cx - h.r) continue;
      if (circleRect(cx, cy, h.r, c.x + 6, -400, CW - 12, c.top + 400 - 14)) return "Bateu no gelo!";
      if (circleRect(cx, cy, h.r, c.x - 2, c.bot + 6, CW + 4, 12)) return "Bateu na chaminé!";
      if (circleRect(cx, cy, h.r, c.x + 4, c.bot + 14, CW - 8, GROUND - c.bot)) return "Bateu na chaminé!";
    }
    for (const b of S.birds) {
      const by = b.base + Math.sin(b.ph) * b.amp;
      if ((cx - (b.x + 18)) ** 2 + (cy - (by + 15)) ** 2 < (h.r + 11) ** 2) return "Trombou num passarinho!";
    }
  }
  return "";
}

function step(dt) {
  if (S.mode === "dying") {
    S.dieT += dt; S.vy = Math.min(S.vy + G * 1.1 * dt, 900); S.y = Math.min(S.y + S.vy * dt, GROUND - 10);
    S.rot += 9 * dt; S.shake = Math.max(0, S.shake - dt);
    if (S.dieT > 0.95) gameOver();
    return;
  }
  S.t += dt;
  const d = diff(S.t);
  S.speed = d.speed;
  const dx = S.speed * dt;
  S.scroll += dx;

  // trenó
  S.vy += (S.holding ? -THRUST : G) * dt;
  S.vy = clamp(S.vy, VMAX_UP, VMAX_DOWN);
  S.y += S.vy * dt;
  if (S.y < CEIL + 20) { S.y = CEIL + 20; if (S.vy < 0) S.vy = 0; }
  S.rot = lerp(S.rot, clamp(S.vy / 1100, -0.32, 0.42), Math.min(1, dt * 12));

  // colunas
  for (const c of S.cols) c.x -= dx;
  for (const it of S.items) it.x -= dx;
  for (const b of S.birds) { b.x -= dx; b.ph += b.sp * dt; }
  const last = S.cols[S.cols.length - 1];
  if (!last) spawnCol(W + 160);
  else if (last.x < W + 40 - d.spacing) spawnCol(last.x + d.spacing);
  S.cols = S.cols.filter((c) => c.x > -CW - 20);
  S.items = S.items.filter((i) => i.x > -40 && !i.gone);
  S.birds = S.birds.filter((b) => b.x > -60);

  // pontos
  for (const c of S.cols) if (!c.passed && c.x + CW < SX - 30) { c.passed = true; addScore(1); }
  for (const it of S.items) {
    if (it.got) continue;
    const dxp = it.x - (SX + 6), dyp = it.y - S.y;
    if (dxp * dxp + dyp * dyp < 34 * 34) {
      it.got = true; it.gone = true;
      const v = it.kind === "gift" ? 20 : 5;
      addScore(v);
      S.pops.push({ x: it.x, y: it.y, txt: "+" + v, t: 0, big: it.kind === "gift" });
      burst(it.x, it.y, it.kind === "gift" ? "#ef4b4b" : "#ffd23f");
    }
  }

  // aviso de "mais rápido"
  if (S.t > S.nextSpeedUp && S.speed < 430) { S.nextSpeedUp += 20; S.banner = { txt: "Mais rápido! 🚀", t: 0 }; }

  // rastro de brilho
  S.trailT -= dt;
  if (S.trailT <= 0) {
    S.trailT = 0.03;
    S.trail.push({ x: SX - 50, y: S.y + 14 + rand(-4, 4), r: rand(2, 4.5), t: 0, c: Math.random() < 0.5 ? "#ffd23f" : "#ffffff" });
    if (S.trail.length > 34) S.trail.shift();
  }

  const why = hitTest();
  if (why) die(why);
}

function addScore(v) { S.score += v; setScore(S.score); }
function burst(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(60, 170);
    S.trail.push({ x, y, r: rand(2, 4), t: 0, c: color, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55 });
  }
}

function die(why) {
  S.mode = "dying"; S.why = why; S.dieT = 0; S.vy = Math.min(S.vy, -220); S.shake = 0.35; S.holding = false;
  try { navigator.vibrate?.(140); } catch {}
  $("#hint").hidden = true;
}

/* ---------------- desenho ---------------- */
const SKY = [
  [0, "#6fc3f7", "#cdeeff"],      // dia
  [0.5, "#ff9a8b", "#ffe3a8"],    // pôr do sol
  [1, "#1f2d63", "#4f5f9e"],      // noite
];
function skyColors(p) {
  const i = p < 0.5 ? 0 : 1, t = (p - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
  return [mix(SKY[i][1], SKY[i + 1][1], t), mix(SKY[i][2], SKY[i + 1][2], t)];
}

function draw() {
  const phase = clamp(S.t / 110, 0, 1);
  const shakeX = S.shake > 0 ? rand(-1, 1) * 6 * S.shake : 0, shakeY = S.shake > 0 ? rand(-1, 1) * 6 * S.shake : 0;
  ctx.setTransform(k, 0, 0, k, shakeX * k, (topExtra + shakeY) * k);

  // céu
  const [top, bot] = skyColors(phase);
  const grd = ctx.createLinearGradient(0, -topExtra, 0, GROUND);
  grd.addColorStop(0, top); grd.addColorStop(1, bot);
  ctx.fillStyle = grd; ctx.fillRect(-10, -topExtra - 10, W + 20, visH + 20);

  // estrelas e lua à noite
  if (phase > 0.55) {
    const a = (phase - 0.55) / 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    for (let i = 0; i < 40; i++) { const x = (i * 97 + 13) % W, y = (i * 53) % 330 + 10; ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = a; ctx.fillStyle = "#fff8d6"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(320, 110, 26, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // nuvens decorativas
  for (const c of S.clouds) {
    const x = ((c.x - S.scroll * 0.12) % (W + 220) + W + 220) % (W + 220) - 170;
    stamp(SPR.cloud, x, c.y, 150 * c.s, 64 * c.s);
  }
  // montanhas e vilarejo (parallax)
  tile(SPR.mount, S.scroll * 0.2, GROUND - 250);
  tile(SPR.town, S.scroll * 0.5, GROUND - 140);

  // colunas
  for (const c of S.cols) {
    const iceH = c.top + 10; // do teto (y = -10) até o vão
    stamp(SPR.ice, c.x, -10, CW, iceH, 640 - iceH, iceH);
    const chH = GROUND - c.bot + 4;
    stamp(SPR.chimney, c.x, c.bot, CW, chH, 0, chH);
  }

  // itens
  for (const it of S.items) {
    const bob = Math.sin(S.t * 4 + it.ph) * 4;
    if (it.kind === "star") stamp(SPR.star, it.x - 15, it.y - 15 + bob);
    else stamp(SPR.gift, it.x - 16, it.y - 16 + bob);
  }
  for (const b of S.birds) stamp(SPR.bird[Math.floor(S.t * 8 + b.ph) % 2], b.x, b.base + Math.sin(b.ph) * b.amp);

  // teto de nuvens e chão
  ctx.fillStyle = "#fff"; ctx.fillRect(-10, -topExtra - 10, W + 20, topExtra + CEIL - 50);
  tile(SPR.ceil, S.scroll * 0.9, CEIL - 66);
  tile(SPR.ground, S.scroll, GROUND - 6);
  if (botExtra > 0) { ctx.fillStyle = "#fff"; ctx.fillRect(-10, GROUND + 70, W + 20, botExtra + 40); }

  // rastro e partículas
  for (const p of S.trail) {
    const life = p.life || 0.5, a = 1 - p.t / life;
    if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.4), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // trenó
  ctx.save();
  ctx.translate(SX, S.y); ctx.rotate(S.rot);
  stamp(SPR.sleigh, -SLEIGH_W / 2, -SLEIGH_H / 2);
  ctx.restore();

  // "+5" / "+20"
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  for (const p of S.pops) {
    const a = 1 - p.t / 0.8; if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.font = `700 ${p.big ? 28 : 22}px Fredoka, sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.fillStyle = p.big ? "#ff6b6b" : "#ffd23f";
    ctx.strokeText(p.txt, p.x, p.y - p.t * 50); ctx.fillText(p.txt, p.x, p.y - p.t * 50);
  }
  ctx.globalAlpha = 1;
  if (S.banner) {
    const a = S.banner.t < 0.2 ? S.banner.t / 0.2 : 1 - Math.max(0, S.banner.t - 1.1) / 0.4;
    if (a > 0) {
      ctx.globalAlpha = a; ctx.font = "700 30px Fredoka, sans-serif"; ctx.lineWidth = 6;
      ctx.strokeStyle = INK; ctx.fillStyle = "#fff";
      ctx.strokeText(S.banner.txt, W / 2, 210); ctx.fillText(S.banner.txt, W / 2, 210); ctx.globalAlpha = 1;
    }
  }

  // neve na frente
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath();
  for (const f of S.snow) { ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, 7); }
  ctx.fill();
}

// repete um sprite na horizontal com deslocamento (parallax)
function tile(s, off, y) {
  for (let x = -(((off % s.w) + s.w) % s.w); x < W; x += s.w) stamp(s, x, y);
}

/* ---------------- animações que não são física ---------------- */
function animate(dt) {
  for (const p of S.trail) { p.t += dt; if (p.vx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } else p.x -= (S.mode === "play" ? S.speed : 80) * dt; }
  S.trail = S.trail.filter((p) => p.t < (p.life || 0.5));
  for (const p of S.pops) p.t += dt;
  S.pops = S.pops.filter((p) => p.t < 0.8);
  if (S.banner) { S.banner.t += dt; if (S.banner.t > 1.5) S.banner = null; }
  const drift = (S.mode === "play" ? S.speed : 60) * 0.35;
  for (const f of S.snow) {
    f.y += f.vy * dt; f.x += (f.vx - drift) * dt;
    if (f.y > 600 + botExtra) { f.y = -topExtra - 5; f.x = rand(0, W + 60); }
    if (f.x < -10) f.x += W + 20;
  }
}

/* ---------------- placar e telas ---------------- */
const scoreEl = $("#score"), pill = $(".score-pill");
function setScore(v) {
  scoreEl.textContent = v;
  if (v) { pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
}
function show(id) { ["#startPanel", "#overPanel", "#pausePanel"].forEach((p) => ($(p).hidden = p !== id)); }

function toMenu() {
  S.mode = "menu"; resetRun(); S.y = 280;
  $("#hud").hidden = true; $("#hint").hidden = true;
  const b = best.get();
  $("#bestStart").hidden = !b; $("#bestStart b").textContent = b;
  show("#startPanel");
}
function toReady() {
  resetRun(); S.mode = "ready";
  show(null); $("#hud").hidden = false; $("#hint").hidden = false;
}
function startPlay() { S.mode = "play"; $("#hint").hidden = true; }
function gameOver() {
  S.mode = "over";
  const b = best.get(), isRecord = S.score > b;
  if (isRecord) best.set(S.score);
  $("#overWhy").textContent = S.why;
  $("#finalScore").textContent = S.score;
  $("#newRecord").hidden = !isRecord || S.score === 0;
  $("#bestOver").innerHTML = `Recorde no treino: <b>${Math.max(b, S.score)}</b>`;
  $("#hud").hidden = true;
  show("#overPanel");
}
function pause() {
  if (S.mode !== "play" && S.mode !== "ready") return;
  S.prevMode = S.mode; S.mode = "paused"; S.holding = false; show("#pausePanel"); $("#hint").hidden = true;
}
function resume() { S.mode = S.prevMode || "play"; show(null); if (S.mode === "ready") $("#hint").hidden = false; last = performance.now(); acc = 0; }

/* ---------------- controles ---------------- */
const pointers = new Set();
function press(id) {
  pointers.add(id);
  if (S.mode === "ready") startPlay();
  if (S.mode === "play") S.holding = true;
}
function release(id) { pointers.delete(id); if (!pointers.size) S.holding = false; }
cv.addEventListener("pointerdown", (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} press(e.pointerId); });
addEventListener("pointerup", (e) => release(e.pointerId));
addEventListener("pointercancel", (e) => release(e.pointerId));
addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); if (!e.repeat) press("kb"); }
  if (e.code === "Escape" || e.code === "KeyP") (S.mode === "paused" ? resume() : pause());
});
addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ArrowUp") release("kb"); });
addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
addEventListener("blur", () => { pointers.clear(); S.holding = false; });

$("#trainBtn").addEventListener("click", toReady);
$("#againBtn").addEventListener("click", toReady);
$("#menuBtn").addEventListener("click", toMenu);
$("#quitBtn").addEventListener("click", toMenu);
$("#pauseBtn").addEventListener("click", (e) => { e.stopPropagation(); pause(); });
$("#resumeBtn").addEventListener("click", resume);
addEventListener("resize", () => { resize(); });

/* ---------------- laço principal ---------------- */
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  if (S.mode === "play" || S.mode === "dying") {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; }
  } else if (S.mode !== "paused") {
    // menu / pronto / fim: cenário passando devagar e trenó flutuando
    S.scroll += 60 * dt;
    if (S.mode !== "over") { S.t2 = (S.t2 || 0) + dt; S.y = (S.mode === "ready" ? 270 : 280) + Math.sin(S.t2 * 2.6) * 10; S.rot = Math.sin(S.t2 * 2.6 + 1) * 0.06; }
  }
  if (S.mode !== "paused") animate(dt);
  draw();
  requestAnimationFrame(frame);
}

(async function main() {
  santaImg = await loadSanta();
  resize();
  initDecor();
  try { await document.fonts.ready; } catch {}
  toMenu();
  requestAnimationFrame((t) => { last = t; frame(t); });
  // ganchos para os testes automáticos (só leitura do estado)
  window.__treno = { get state() { return { mode: S.mode, score: S.score, t: S.t, y: S.y, vy: S.vy, speed: S.speed, cols: S.cols.map((c) => ({ x: c.x, top: c.top, bot: c.bot })) }; } };
})();
