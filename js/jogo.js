// Entrega Expressa — minijogo de Natal
// O trenó voa no alto e a cidade passa embaixo. Toque para soltar um presente: ele cai em arco
// e precisa entrar na chaminé. Cada entrega dá tempo extra; o jogo acaba quando o relógio zera.
//
// Desempenho: fundo (montanhas, nuvens, chão) e trenó são pré-renderizados; casas e chaminés são
// formas simples desenhadas por quadro. Justiça: física em passo fixo (1/120 s) e área de jogo
// sempre com 400 de largura lógica (ninguém enxerga mais cidade que os outros).
import { SANTA_SVG } from "./santa.js";
import { isDev } from "./dev.js";

if (!isDev()) location.replace("./");

const $ = (s) => document.querySelector(s);
// celulares antigos não têm roundRect no canvas: usa retângulo comum
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
const cv = $("#cv");
const ctx = cv.getContext("2d", { alpha: false });
const INK = "#2b2a3a";

/* ---------------- regras ---------------- */
const W = 400, GROUND = 560;
const SX = 118, SY = 150;              // posição do trenó
const SLEIGH_W = 116, SLEIGH_H = 58;
const DT = 1 / 120;
const GIFT_R = 11, GIFT_G = 1000, GIFT_VX = 35, GIFT_VY = 40;
const DROP_COOLDOWN = 0.28, MAX_GIFTS = 3;
const T_START = 20, T_MAX = 25;
const T_MISS = -1, T_FIRE = -2;
// Equilíbrio: o bônus por entrega diminui e o relógio corre mais rápido com o tempo,
// então até quem acerta tudo uma hora perde (o jogo precisa acabar para ter ranking).
const bonus = (t) => Math.max(0.8, 2 - t * 0.012);     // entrega normal: +2 s → +0,8 s
const drain = (t) => 1 + t / 60;                        // relógio: 1x → 2x em 1 min → 3x em 2 min

const diff = (t) => ({
  speed: Math.min(150 + t * 1.6, 340),          // cidade passando
  opening: Math.max(30, 56 - t * 0.26),          // boca da chaminé
  gapMin: Math.max(18, 60 - t * 0.5), gapMax: Math.max(70, 130 - t * 0.7),
  moving: t > 25 ? Math.min(0.45, (t - 25) / 80) : 0,   // chance de chaminé que sobe e desce
  fire: t > 40 ? Math.min(0.22, (t - 40) / 120) : 0,     // chance de chaminé com fogo
  gold: t > 12 ? 0.06 : 0,
});
const mult = (combo) => Math.min(5, 1 + Math.floor(combo / 3));

/* ---------------- utilidades ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`; };

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
function tile(s, off, y) { for (let x = -(((off % s.w) + s.w) % s.w); x < W; x += s.w) stamp(s, x, y); }

/* ---------------- desenhos pré-renderizados ---------------- */
let SPR = {}, santaImg = null;
function loadSanta() {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SANTA_SVG.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}
function giftShape(g, body, lid) {
  g.lineWidth = 2.6;
  g.fillStyle = body; g.beginPath(); g.roundRect(3, 11, 26, 19, 3); g.fill(); g.stroke();
  g.fillStyle = lid; g.beginPath(); g.roundRect(1, 6, 30, 8, 3); g.fill(); g.stroke();
  g.fillStyle = "#ffd23f"; g.beginPath(); g.rect(13, 6, 6, 24); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(16, 6); g.bezierCurveTo(8, -4, 2, 4, 16, 6); g.moveTo(16, 6); g.bezierCurveTo(24, -4, 30, 4, 16, 6); g.fill(); g.stroke();
}
function buildSprites() {
  SPR = {};
  SPR.sleigh = sprite(SLEIGH_W, SLEIGH_H, (g) => { if (santaImg) g.drawImage(santaImg, 0, 0, SLEIGH_W, SLEIGH_H); }, 4);
  SPR.gifts = [["#ef4b4b", "#ff6b6b"], ["#2e9e5b", "#45c777"], ["#4fa8e8", "#7cc2f2"], ["#a77bea", "#c19cf2"]]
    .map(([b, l]) => sprite(32, 32, (g) => giftShape(g, b, l)));
  SPR.star = sprite(30, 30, (g) => {
    g.fillStyle = "#ffd23f"; g.lineWidth = 2.6; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6.5 : 14.5; g.lineTo(15 + Math.cos(a) * r, 15 + Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
  });
  SPR.cloud = sprite(150, 64, (g) => {
    g.fillStyle = "rgba(255,255,255,.92)"; g.lineWidth = 3; g.beginPath();
    g.moveTo(14, 56); g.quadraticCurveTo(-6, 54, 6, 38); g.quadraticCurveTo(4, 18, 30, 24);
    g.quadraticCurveTo(42, 0, 70, 12); g.quadraticCurveTo(96, -2, 108, 22); g.quadraticCurveTo(140, 16, 140, 40);
    g.quadraticCurveTo(152, 58, 132, 58); g.closePath(); g.fill(); g.stroke();
  });
  SPR.mount = sprite(800, 230, (g) => {
    const peaks = [[0, 150], [90, 40], [190, 130], [300, 20], [420, 120], [520, 50], [640, 140], [720, 70], [800, 150]];
    g.fillStyle = "#e6f3fb"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 230);
    peaks.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(800, 230); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fff";
    [[90, 40], [300, 20], [520, 50], [720, 70]].forEach(([x, y]) => {
      g.beginPath(); g.moveTo(x - 26, y + 34); g.lineTo(x, y); g.lineTo(x + 28, y + 36); g.lineTo(x + 12, y + 28); g.lineTo(x, y + 38); g.lineTo(x - 12, y + 28); g.closePath(); g.fill(); g.stroke();
    });
  });
  SPR.pines = sprite(600, 90, (g) => { // fileira de pinheiros ao fundo
    g.lineWidth = 2.5;
    for (let x = 10, i = 0; x < 600; x += 34 + (i * 17) % 22, i++) {
      const h = 46 + (i * 29) % 34;
      g.fillStyle = i % 2 ? "#2e9e5b" : "#38b468";
      g.beginPath(); g.moveTo(x, 90); g.lineTo(x + 14, 90 - h); g.lineTo(x + 28, 90); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x + 8, 90 - h * 0.62); g.lineTo(x + 14, 90 - h); g.lineTo(x + 20, 90 - h * 0.62); g.quadraticCurveTo(x + 14, 90 - h * 0.7, x + 8, 90 - h * 0.62); g.fill(); g.stroke();
    }
  });
  SPR.ground = sprite(400, 80, (g) => {
    g.fillStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, 400); g.lineTo(-10, 8);
    for (let x = -10; x < 410; x += 80) g.quadraticCurveTo(x + 40, -6, x + 80, 8);
    g.lineTo(410, 400); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "rgba(111,195,247,.25)";
    for (let x = 20; x < 400; x += 70) { g.beginPath(); g.ellipse(x, 40, 24, 5, 0, 0, 7); g.fill(); }
  }, 0);
}

/* ---------------- tela ---------------- */
function resize() {
  const vw = innerWidth, vh = innerHeight;
  cssH = vh; cssW = Math.min(vw, Math.round(vh * W / 600));
  scale = cssW / W;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  k = scale * dpr;
  visH = cssH / scale;
  const extra = Math.max(0, visH - 600);
  topExtra = extra * 0.5; botExtra = extra - topExtra;
  cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  $(".hud").style.width = cssW + "px";
  buildSprites();
}

/* ---------------- estado ---------------- */
const S = {
  mode: "menu", t: 0, time: T_START, score: 0, combo: 0, bestCombo: 0, delivered: 0, perfects: 0,
  houses: [], gifts: [], debris: [], pops: [], sparks: [], snow: [], clouds: [],
  scroll: 0, speed: 150, cool: 0, bob: 0, nextX: 0,
};
const best = {
  get: () => { try { return +localStorage.getItem("natal.entrega.best") || 0; } catch { return 0; } },
  set: (v) => { try { localStorage.setItem("natal.entrega.best", String(v)); } catch {} },
};
function initDecor() {
  S.snow = Array.from({ length: 44 }, () => ({ x: rand(0, W), y: rand(-topExtra, 600 + botExtra), r: rand(1.2, 3.2), vy: rand(22, 55), vx: rand(-10, 10) }));
  S.clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 130 + rand(0, 60), y: rand(40, 230), s: rand(.5, .85) }));
}

const ROOFS = ["#ef4b4b", "#2e9e5b", "#4fa8e8", "#a77bea", "#ff9f43"];
const WALLS = ["#fff6e6", "#ffe9d2", "#f3ecff", "#e6f6ee"];
function makeHouse(x) {
  const d = diff(S.t);
  const w = rand(118, 168), wallH = rand(70, 128), roofH = rand(40, 60);
  const wallTop = GROUND - wallH, apex = wallTop - roofH;
  // chaminé num dos lados do telhado
  const side = Math.random() < 0.5 ? -1 : 1;
  const f = rand(0.2, 0.3);
  const ow = d.opening, outer = ow + 16;
  const cxRel = w / 2 + side * w * f;
  const baseY = wallTop - roofH * (1 - Math.abs(cxRel - w / 2) / (w / 2));
  const ch = rand(30, 52);
  let type = "normal";
  const r = Math.random();
  if (r < d.fire) type = "fire"; else if (r < d.fire + d.gold) type = "gold";
  const moving = type !== "fire" && Math.random() < d.moving ? { amp: rand(14, 24), ph: rand(0, 6), sp: rand(1.6, 2.6) } : null;
  return {
    x, w, wallTop, apex, roof: ROOFS[Math.floor(rand(0, ROOFS.length))], wall: WALLS[Math.floor(rand(0, WALLS.length))],
    lit: false, chim: { cxRel, ow, outer, baseY, h: ch, type, moving, done: false, missed: false, flash: 0 },
  };
}
// topo da chaminé (pode subir e descer)
const chimTop = (c) => c.baseY - c.h - (c.moving ? (Math.sin(c.moving.ph) * 0.5 + 0.5) * c.moving.amp : 0);
function roofY(h, ax) { // altura do telhado no x absoluto ax
  const rx = ax - h.x;
  if (rx < 0 || rx > h.w) return Infinity;
  const roofH = h.wallTop - h.apex;
  return h.wallTop - roofH * (1 - Math.abs(rx - h.w / 2) / (h.w / 2)) - 2;
}

function resetRun() {
  Object.assign(S, { t: 0, time: T_START, score: 0, combo: 0, bestCombo: 0, delivered: 0, perfects: 0, houses: [], gifts: [], debris: [], pops: [], sparks: [], cool: 0, speed: diff(0).speed });
  let x = 230;
  while (x < W + 300) { const h = makeHouse(x); S.houses.push(h); x += h.w + rand(30, 90); }
  S.nextX = x;
  updateHud(true);
}

/* ---------------- ações ---------------- */
function drop() {
  if (S.mode === "ready") startPlay();
  if (S.mode !== "play" || S.cool > 0 || S.gifts.length >= MAX_GIFTS) return;
  S.cool = DROP_COOLDOWN;
  S.gifts.push({ x: SX + 8, y: SY + 18, vx: GIFT_VX, vy: GIFT_VY, rot: 0, vr: rand(-3, 3), spr: Math.floor(rand(0, SPR.gifts.length)) });
}

function addTime(dt, x, y) {
  dt = Math.round(dt * 10) / 10;
  S.time = clamp(S.time + dt, 0, T_MAX);
  const p = $("#timerPill"); p.classList.remove("plus", "minus"); void p.offsetWidth; p.classList.add(dt > 0 ? "plus" : "minus");
  S.pops.push({ x, y: y - 24, txt: (dt > 0 ? "+" : "") + dt + "s", color: dt > 0 ? "#45c777" : "#ef4b4b", t: 0, size: 20 });
}
function deliver(h, perfect) {
  const c = h.chim, gold = c.type === "gold";
  c.done = true; c.flash = 1; h.lit = true;
  S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo); S.delivered++;
  if (perfect) S.perfects++;
  const m = mult(S.combo), pts = (gold ? 50 : perfect ? 25 : 10) * m;
  S.score += pts;
  const ax = h.x + c.cxRel, ay = chimTop(c);
  const b = bonus(S.t);
  addTime(gold ? b + 2 : perfect ? b + 1 : b, ax, ay);
  S.pops.push({ x: ax, y: ay - 52, txt: gold ? "DOURADA!" : perfect ? "PERFEITO!" : "+" + pts, color: gold || perfect ? "#ffd23f" : "#fff", t: 0, size: gold || perfect ? 26 : 22, big: true });
  sparkle(ax, ay, gold || perfect ? "#ffd23f" : "#ffffff", gold || perfect ? 16 : 9);
  updateHud();
}
function miss(g, why) {
  S.combo = 0;
  addTime(why === "fire" ? T_FIRE : T_MISS, g.x, g.y);
  if (why === "fire") { S.pops.push({ x: g.x, y: g.y - 50, txt: "Queimou! 🔥", color: "#ff9f43", t: 0, size: 22, big: true }); sparkle(g.x, g.y, "#ff9f43", 12); }
  S.debris.push({ x: g.x, y: g.y, vx: rand(-120, 120), vy: -rand(220, 320), rot: g.rot, vr: rand(-10, 10), t: 0, spr: g.spr });
  try { navigator.vibrate?.(40); } catch {}
  updateHud();
}
function sparkle(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0), sp = rand(70, 190);
    S.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: rand(2, 4.2), t: 0, life: rand(0.45, 0.75), c: color });
  }
}

/* ---------------- física (passo fixo) ---------------- */
function step(dt) {
  const playing = S.mode === "play";
  if (playing) { S.t += dt; S.time -= dt * drain(S.t); }
  const d = diff(S.t);
  S.speed = d.speed;
  const dx = S.speed * dt;
  S.scroll += dx;
  S.cool = Math.max(0, S.cool - dt);

  // cidade
  for (const h of S.houses) {
    h.x -= dx;
    const c = h.chim;
    if (c.moving) c.moving.ph += c.moving.sp * dt;
    c.flash = Math.max(0, c.flash - dt * 2);
    // chaminé passou sem presente: perde o combo (fogo não conta)
    if (playing && !c.done && !c.missed && c.type !== "fire" && h.x + c.cxRel < SX - 60) {
      c.missed = true;
      if (S.combo >= 3) S.pops.push({ x: SX, y: SY + 70, txt: "combo perdido", color: "#ffffff", t: 0, size: 16 });
      S.combo = 0; updateHud();
    }
  }
  S.nextX -= dx;
  while (S.nextX < W + 260) { const h = makeHouse(S.nextX); S.houses.push(h); S.nextX += h.w + rand(d.gapMin, d.gapMax); }
  S.houses = S.houses.filter((h) => h.x + h.w > -40);

  // presentes caindo
  for (const g of S.gifts) {
    const py = g.y;
    g.vy += GIFT_G * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.rot += g.vr * dt;
    for (const h of S.houses) {
      if (g.x < h.x - 30 || g.x > h.x + h.w + 30) continue;
      const c = h.chim, ax = h.x + c.cxRel, top = chimTop(c);
      const off = Math.abs(g.x - ax), aligned = off <= c.ow / 2 + 3;
      // entrou pela boca da chaminé?
      if (aligned && py <= top && g.y >= top) {
        g.dead = true;
        if (c.type === "fire") miss(g, "fire");
        else if (c.done) miss(g, "done");
        else deliver(h, off <= c.ow * 0.18);
        break;
      }
      // bateu na borda/lateral da chaminé (só se não estiver alinhado com a boca)
      if (!aligned && off < c.outer / 2 + GIFT_R * 0.6 && g.y + GIFT_R > top + 6 && g.y - GIFT_R < c.baseY) { g.dead = true; miss(g, "rim"); break; }
      // bateu no telhado
      if (g.y + GIFT_R > roofY(h, g.x)) { g.dead = true; miss(g, "roof"); break; }
    }
    if (!g.dead && g.y + GIFT_R > GROUND + 4) { g.dead = true; miss(g, "ground"); }
  }
  S.gifts = S.gifts.filter((g) => !g.dead);

  if (playing && S.time <= 0) { S.time = 0; gameOver(); }
}

/* ---------------- desenho ---------------- */
const SKY = [[0, "#6fc3f7", "#cdeeff"], [0.5, "#ff9a8b", "#ffe3a8"], [1, "#1f2d63", "#4f5f9e"]];
function skyColors(p) {
  const i = p < 0.5 ? 0 : 1, t = (p - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
  return [mix(SKY[i][1], SKY[i + 1][1], t), mix(SKY[i][2], SKY[i + 1][2], t)];
}

function drawHouse(h) {
  const c = h.chim, x = h.x, ax = x + c.cxRel, top = chimTop(c);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = "round";
  // parede
  ctx.fillStyle = h.wall; ctx.beginPath(); ctx.rect(x + 8, h.wallTop, h.w - 16, GROUND - h.wallTop + 6); ctx.fill(); ctx.stroke();
  // janelas: apagadas até receber presente
  ctx.fillStyle = h.lit ? "#ffd23f" : "#5d6aa8";
  const rows = h.wallTop < GROUND - 100 ? 2 : 1;
  for (let r = 0; r < rows; r++) for (let wx = x + 22; wx < x + h.w - 34; wx += 30) {
    ctx.beginPath(); ctx.rect(wx, h.wallTop + 14 + r * 34, 16, 18); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#8a5a33"; ctx.beginPath(); ctx.rect(x + h.w / 2 - 9, GROUND - 26, 18, 28); ctx.fill(); ctx.stroke();
  // chaminé (atrás do telhado)
  const cw = c.outer;
  ctx.fillStyle = c.type === "gold" ? "#ffcf3f" : "#c8463e";
  ctx.beginPath(); ctx.rect(ax - cw / 2 + 4, top + 8, cw - 8, c.baseY - top + 6); ctx.fill(); ctx.stroke();
  if (c.type !== "gold") {
    ctx.strokeStyle = "rgba(43,42,58,.22)"; ctx.lineWidth = 2;
    for (let y = top + 22; y < c.baseY; y += 12) { ctx.beginPath(); ctx.moveTo(ax - cw / 2 + 6, y); ctx.lineTo(ax + cw / 2 - 6, y); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
  }
  // telhado com neve
  ctx.fillStyle = h.roof; ctx.beginPath(); ctx.moveTo(x - 4, h.wallTop + 2); ctx.lineTo(x + h.w / 2, h.apex); ctx.lineTo(x + h.w + 4, h.wallTop + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath();
  ctx.moveTo(x - 6, h.wallTop + 3); ctx.lineTo(x + h.w / 2, h.apex - 4); ctx.lineTo(x + h.w + 6, h.wallTop + 3);
  ctx.lineTo(x + h.w - 8, h.wallTop - 4); ctx.lineTo(x + h.w / 2, h.apex + 8); ctx.lineTo(x + 8, h.wallTop - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  // boca da chaminé
  ctx.fillStyle = c.type === "gold" ? "#ffe27a" : "#a8352f";
  ctx.beginPath(); ctx.roundRect(ax - cw / 2, top, cw, 12, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.done ? "#5b3a2a" : INK;
  ctx.beginPath(); ctx.ellipse(ax, top + 3, c.ow / 2, 4, 0, 0, 7); ctx.fill();
  if (c.type === "gold") stamp(SPR.star, ax - 11, top - 30 + Math.sin(S.scroll * 0.03) * 3, 22, 22);
  if (c.type === "fire") drawFire(ax, top, c.ow);
  if (c.done) { // fumacinha de "entregue"
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 3; i++) { const yy = top - 10 - ((S.scroll * 0.4 + i * 14) % 42); ctx.beginPath(); ctx.arc(ax + Math.sin(yy * 0.2) * 5, yy, 5 + i, 0, 7); ctx.fill(); }
  }
  if (c.flash > 0) {
    ctx.globalAlpha = c.flash; ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(ax, top + 3, c.ow / 2 + 10 * (1 - c.flash) + 4, 8 + 6 * (1 - c.flash), 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  }
}
function drawFire(x, top, w) {
  const t = S.scroll * 0.05;
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
  for (let i = -1; i <= 1; i++) {
    const fx = x + i * w * 0.28, fh = 18 + Math.sin(t * 3 + i * 2) * 5 + (i === 0 ? 8 : 0);
    ctx.fillStyle = "#ff9f43"; ctx.beginPath(); ctx.moveTo(fx - 7, top + 2); ctx.quadraticCurveTo(fx - 8, top - fh * 0.5, fx, top - fh); ctx.quadraticCurveTo(fx + 8, top - fh * 0.5, fx + 7, top + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.moveTo(fx - 3, top + 2); ctx.quadraticCurveTo(fx - 3, top - fh * 0.3, fx, top - fh * 0.55); ctx.quadraticCurveTo(fx + 3, top - fh * 0.3, fx + 3, top + 2); ctx.closePath(); ctx.fill();
  }
  ctx.lineWidth = 3;
}

function draw() {
  const phase = clamp(S.t / 120, 0, 1);
  ctx.setTransform(k, 0, 0, k, 0, topExtra * k);
  const [top, bot] = skyColors(phase);
  const grd = ctx.createLinearGradient(0, -topExtra, 0, GROUND);
  grd.addColorStop(0, top); grd.addColorStop(1, bot);
  ctx.fillStyle = grd; ctx.fillRect(-10, -topExtra - 10, W + 20, visH + 20);
  if (phase > 0.55) {
    const a = (phase - 0.55) / 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 + 13) % W, (i * 53) % 300 - topExtra * 0.5, 2, 2);
    ctx.globalAlpha = a; ctx.fillStyle = "#fff8d6"; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(330, 70, 24, 0, 7); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  for (const c of S.clouds) {
    const x = ((c.x - S.scroll * 0.1) % (W + 220) + W + 220) % (W + 220) - 170;
    stamp(SPR.cloud, x, c.y, 150 * c.s, 64 * c.s);
  }
  tile(SPR.mount, S.scroll * 0.15, GROUND - 270);
  tile(SPR.pines, S.scroll * 0.35, GROUND - 90);

  for (const h of S.houses) if (h.x < W + 20) drawHouse(h);
  tile(SPR.ground, S.scroll, GROUND - 6);
  if (botExtra > 0) { ctx.fillStyle = "#fff"; ctx.fillRect(-10, GROUND + 70, W + 20, botExtra + 40); }

  // presentes no ar e os que quicaram
  for (const g of S.gifts) { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot * 0.15); stamp(SPR.gifts[g.spr], -14, -14, 28, 28); ctx.restore(); }
  for (const g of S.debris) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - g.t / 0.7); ctx.translate(g.x, g.y); ctx.rotate(g.rot); stamp(SPR.gifts[g.spr], -14, -14, 28, 28); ctx.restore(); }
  ctx.globalAlpha = 1;
  for (const p of S.sparks) {
    const a = 1 - p.t / p.life; if (a <= 0) continue;
    ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // trenó (dá um "tranco" quando solta presente)
  ctx.save();
  const kick = S.cool > 0 ? Math.sin((S.cool / DROP_COOLDOWN) * Math.PI) * 0.06 : 0;
  ctx.translate(SX, SY + Math.sin(S.bob * 2.4) * 6); ctx.rotate(Math.sin(S.bob * 2.4 + 1) * 0.04 - kick);
  stamp(SPR.sleigh, -SLEIGH_W / 2, -SLEIGH_H / 2);
  ctx.restore();

  // textos
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  for (const p of S.pops) {
    const a = 1 - p.t / 0.9; if (a <= 0) continue;
    const sc = p.big ? 1 + Math.max(0, 0.25 - p.t) * 1.6 : 1;
    ctx.globalAlpha = a; ctx.font = `700 ${Math.round(p.size * sc)}px Fredoka, sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.fillStyle = p.color;
    ctx.strokeText(p.txt, p.x, p.y - p.t * 40); ctx.fillText(p.txt, p.x, p.y - p.t * 40);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath();
  for (const f of S.snow) { ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, 7); }
  ctx.fill();
}

/* ---------------- animações que não são física ---------------- */
function animate(dt) {
  S.bob += dt;
  for (const g of S.debris) { g.t += dt; g.vy += GIFT_G * dt; g.x += g.vx * dt - S.speed * dt; g.y += g.vy * dt; g.rot += g.vr * dt; }
  S.debris = S.debris.filter((g) => g.t < 0.7);
  for (const p of S.sparks) { p.t += dt; p.x += p.vx * dt - S.speed * dt * 0.5; p.y += p.vy * dt; p.vy += 300 * dt; p.vx *= 0.96; }
  S.sparks = S.sparks.filter((p) => p.t < p.life);
  for (const p of S.pops) p.t += dt;
  S.pops = S.pops.filter((p) => p.t < 0.9);
  const drift = S.speed * 0.3;
  for (const f of S.snow) {
    f.y += f.vy * dt; f.x += (f.vx - drift) * dt;
    if (f.y > 600 + botExtra) { f.y = -topExtra - 5; f.x = rand(0, W + 60); }
    if (f.x < -10) f.x += W + 20;
  }
}

/* ---------------- placar ---------------- */
const el = { timer: $("#timer"), bar: $("#timerBar"), pill: $("#timerPill"), score: $("#score"), combo: $("#combo") };
let shownCombo = 0, shownLow = null, lastTimerTxt = "";
function updateHud(force) {
  el.score.textContent = S.score;
  const m = mult(S.combo);
  if (m !== shownCombo || force) {
    el.combo.hidden = m < 2; el.combo.textContent = "x" + m;
    if (m > shownCombo && m >= 2) { el.combo.classList.remove("pop"); void el.combo.offsetWidth; el.combo.classList.add("pop"); }
    shownCombo = m;
  }
}
function updateTimer() {
  const txt = S.time.toFixed(1);
  if (txt !== lastTimerTxt) { el.timer.textContent = txt; lastTimerTxt = txt; }
  el.bar.style.width = (S.time / T_MAX) * 100 + "%";
  const low = S.time < 5;
  if (low !== shownLow) { el.pill.classList.toggle("low", low); shownLow = low; }
}

/* ---------------- telas ---------------- */
function show(id) { ["#startPanel", "#overPanel", "#pausePanel"].forEach((p) => ($(p).hidden = p !== id)); }
function toMenu() {
  S.mode = "menu"; resetRun();
  $("#hud").hidden = true; $("#hint").hidden = true;
  const b = best.get(); $("#bestStart").hidden = !b; $("#bestStart b").textContent = b;
  show("#startPanel");
}
function toReady() { resetRun(); S.mode = "ready"; show(null); $("#hud").hidden = false; $("#hint").hidden = false; updateTimer(); }
function startPlay() { S.mode = "play"; $("#hint").hidden = true; }
function gameOver() {
  S.mode = "over";
  const b = best.get(), rec = S.score > b && S.score > 0;
  if (rec) best.set(S.score);
  $("#finalScore").textContent = S.score;
  $("#stats").innerHTML = `
    <li><span>🎁 Entregas</span><b>${S.delivered}</b></li>
    <li><span>🎯 Perfeitos</span><b>${S.perfects}</b></li>
    <li><span>⚡ Maior combo</span><b>${S.bestCombo}</b></li>
    <li><span>⏱️ Tempo voando</span><b>${Math.floor(S.t)}s</b></li>`;
  $("#newRecord").hidden = !rec;
  $("#bestOver").innerHTML = `Recorde no treino: <b>${Math.max(b, S.score)}</b>`;
  $("#hud").hidden = true;
  show("#overPanel");
}
function pause() {
  if (S.mode !== "play" && S.mode !== "ready") return;
  S.prevMode = S.mode; S.mode = "paused"; show("#pausePanel"); $("#hint").hidden = true;
}
function resume() { S.mode = S.prevMode || "play"; show(null); if (S.mode === "ready") $("#hint").hidden = false; last = performance.now(); acc = 0; }

/* ---------------- controles ---------------- */
cv.addEventListener("pointerdown", (e) => { e.preventDefault(); drop(); });
addEventListener("keydown", (e) => {
  if ((e.code === "Space" || e.code === "ArrowDown" || e.code === "Enter") && !e.repeat) { e.preventDefault(); if (S.mode === "play" || S.mode === "ready") drop(); }
  if (e.code === "Escape" || e.code === "KeyP") (S.mode === "paused" ? resume() : pause());
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

/* ---------------- laço principal ---------------- */
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  if (S.mode === "play" || S.mode === "ready") {
    acc += dt;
    while (acc >= DT) { step(DT); acc -= DT; if (S.mode === "over") break; }
    if (S.mode !== "over") updateTimer();
  } else if (S.mode === "menu" || S.mode === "over") {
    // cidade passando devagar atrás do menu
    S.scroll += 40 * dt; for (const h of S.houses) h.x -= 40 * dt; S.nextX -= 40 * dt;
    while (S.nextX < W + 260) { const h = makeHouse(S.nextX); S.houses.push(h); S.nextX += h.w + rand(40, 110); }
    S.houses = S.houses.filter((h) => h.x + h.w > -40);
  }
  if (S.mode !== "paused") animate(dt);
  draw();
  requestAnimationFrame(frame);
}

(async function main() {
  santaImg = await loadSanta();
  resize(); initDecor();
  try { await document.fonts.ready; } catch {}
  toMenu();
  requestAnimationFrame((t) => { last = t; frame(t); });
  // ganchos para os testes automáticos (só leitura)
  window.__entrega = {
    get state() {
      return { mode: S.mode, t: S.t, time: S.time, score: S.score, combo: S.combo, delivered: S.delivered, perfects: S.perfects, speed: S.speed,
        gifts: S.gifts.length, cool: S.cool,
        houses: S.houses.map((h) => ({ ax: h.x + h.chim.cxRel, top: chimTop(h.chim), ow: h.chim.ow, type: h.chim.type, done: h.chim.done, missed: h.chim.missed, moving: !!h.chim.moving })) };
    },
    consts: { SX, SY, GIFT_G, GIFT_VX, GIFT_VY },
  };
})();
