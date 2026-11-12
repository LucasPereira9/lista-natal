import { api, DEMO, getSavedCode, forgetCode } from "./api.js";
import { TITULO, ANO } from "../config.js";

const $ = (s, el = document) => el.querySelector(s);
const state = { people: [], q: "" };

/* ---------- utilidades ---------- */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
function price(i) {
  const a = i.price_min, b = i.price_max;
  if (a != null && b != null) return a === b ? brl(a) : `${brl(a)} – ${brl(b)}`;
  if (a != null) return `a partir de ${brl(a)}`;
  if (b != null) return `até ${brl(b)}`;
  return "";
}
function highlight(text, q) {
  if (!q) return esc(text);
  const n = norm(text), i = n.indexOf(norm(q));
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "loja"; } };
const safeUrl = (u) => (/^(https?:|data:image\/)/i.test(u || "") ? u : "");

// Ícone de cada presente. Vale o termo que aparece PRIMEIRO no título ("Sapato ou chinelo" → 👞);
// se o título não disser nada, tenta os detalhes. Texto já normalizado (sem acento, minúsculo).
// Em empate na mesma posição, ganha quem vem antes na lista (por isso os mais específicos ficam em cima).
const CATS = [
  // roupas
  { k: "roupa", icon: "🧥", re: /\broupa de (frio|inverno)|\bjaqueta|\bcasaco|\bmoletom|\bcardigan|\bcorta.?vento|\bblusa de frio/ },
  { k: "brinquedo", icon: "⚽", re: /\bcamisa de time|\bbola\b|\bfutebol|\bchuteira/ },
  { k: "roupa", icon: "👔", re: /\bcamisa social|\bgravata|\bterno\b/ },
  { k: "roupa", icon: "🧦", re: /\bmeias?\b/ },
  { k: "roupa", icon: "🩳", re: /\bshorts?\b|\bbermuda|\bsunga/ },
  { k: "roupa", icon: "👙", re: /\bbiquini|\bmaio\b/ },
  { k: "roupa", icon: "👖", re: /\bcalcas?\b|\bjeans|\blegging/ },
  { k: "roupa", icon: "👗", re: /\bvestido|\bsaia/ },
  { k: "roupa", icon: "🩲", re: /\bcueca|\bcalcinha|\blingerie/ },
  { k: "roupa", icon: "🧢", re: /\bbone\b|\bchapeu|\btouca/ },
  { k: "acessorio", icon: "🧣", re: /\bcachecol|\bluvas?\b/ },
  { k: "roupa", icon: "👕", re: /\bcamis|\bblusa|\bregata|\bcropped|\broupa|\bconjunto|\bpijama|\bmalha/ },
  // calçados
  { k: "calcado", icon: "🩴", re: /\bchinelo|\bsandalia|\brasteirinha|\bslide/ },
  { k: "calcado", icon: "👠", re: /\bsalto|\bscarpin/ },
  { k: "calcado", icon: "🥾", re: /\bbota|\bcoturno/ },
  { k: "calcado", icon: "👞", re: /\bsapato|\bmocassim|\bsapatenis/ },
  { k: "calcado", icon: "👟", re: /\btenis|\bcalcado/ },
  // beleza
  { k: "beleza", icon: "🌸", re: /\bperfume|\bbody splash|\bsplash|\bcolonia/ },
  { k: "beleza", icon: "💄", re: /\bmaquiagem|\bbatom|\brimel|\bpaleta/ },
  { k: "beleza", icon: "💅", re: /\besmalte|\bunhas?\b/ },
  { k: "beleza", icon: "🧴", re: /\bcreme|\bhidratante|\bprotetor|\bshampoo|\bsabonete|\bkit de banho|\bskin ?care/ },
  // acessórios
  { k: "acessorio", icon: "⌚", re: /\brelogio|\bsmartwatch/ },
  { k: "acessorio", icon: "🎒", re: /\bmochila/ },
  { k: "acessorio", icon: "👜", re: /\bbolsa|\bcarteira|\bnecessaire/ },
  { k: "acessorio", icon: "🕶️", re: /\boculos/ },
  { k: "acessorio", icon: "💍", re: /\bbrincos?\b|\baneis\b|\banel\b|\bcolar\b|\bpulseira|\bjoia|\bcorrente|\bpingente|\bbijuteria/ },
  // eletrônicos
  { k: "eletronico", icon: "🎧", re: /\bfones?\b|\bheadphone|\bairpods?|\bcaixa de som/ },
  { k: "eletronico", icon: "📱", re: /\bcelular|\biphone|\bsmartphone|\bcapinha/ },
  { k: "eletronico", icon: "💻", re: /\bnotebook|\blaptop|\bcomputador|\btablet|\bipad/ },
  { k: "eletronico", icon: "🎮", re: /\bvideo ?game|\bplaystation|\bps[45]\b|\bxbox|\bnintendo|\bjogo/ },
  // papelaria
  { k: "papelaria", icon: "📚", re: /\blivros?\b|\bgibi|\bhq\b/ },
  { k: "papelaria", icon: "📒", re: /\bcaderno|\bagenda|\bplanner|\bcaneta|\bestojo/ },
  // brinquedos e lazer
  { k: "brinquedo", icon: "🏎️", re: /\bcarrinho|\bpista|\bhot ?wheels|\bcontrole remoto/ },
  { k: "brinquedo", icon: "🦸", re: /\bsuper.?heroi|\bheroi|\bhomem.?aranha|\bbatman/ },
  { k: "brinquedo", icon: "🧱", re: /\blego\b|\bblocos? de montar/ },
  { k: "brinquedo", icon: "🧸", re: /\bboneca|\bbrinquedo|\bpelucia|\bbarbie/ },
  { k: "brinquedo", icon: "🚲", re: /\bbicicleta|\bbike\b|\bpatinete|\bskate|\bpatins/ },
  // casa, comida e outros
  { k: "casa", icon: "🍫", re: /\bchocolate|\bbombom|\bpanetone/ },
  { k: "casa", icon: "🍷", re: /\bvinho|\bespumante|\bcerveja|\bwhisky/ },
  { k: "casa", icon: "☕", re: /\bcaneca|\bxicara|\bcafeteira/ },
  { k: "casa", icon: "🪴", re: /\bplanta|\bvaso\b|\bflores?\b/ },
  { k: "casa", icon: "🛏️", re: /\btoalha|\blencol|\bedredom|\bcobertor|\btravesseiro|\bmanta\b/ },
  { k: "casa", icon: "🎟️", re: /\bingresso|\bviagem/ },
  { k: "casa", icon: "💵", re: /\bdinheiro|\bpix\b|\bvale.?presente|\bgift ?card/ },
];
const OUTRO = { k: "outro", icon: "🎁" };
function catOf(text) {
  const t = norm(text || "");
  let best = null, at = Infinity;
  for (const c of CATS) { const m = c.re.exec(t); if (m && m.index < at) { at = m.index; best = c; } }
  return best;
}
const cat = (i) => catOf(i.title) || catOf(i.details) || OUTRO;

const SMALL = new Set(["de", "da", "do", "das", "dos", "e"]);
const cap = (s) => s.trim().split(/\s+/).map((w, i) => (i && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
function hue(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3000);
}

/* ---------- carregando ---------- */
// Barra listrada no topo enquanto houver qualquer requisição em andamento
let pending = 0;
function busy(on) {
  pending = Math.max(0, pending + (on ? 1 : -1));
  document.body.classList.toggle("busy", pending > 0);
}

// Trava o formulário (evita toque duplo) e mostra spinner no botão clicado
function freeze(form, btn, label) {
  form.classList.add("is-loading");
  const els = [...form.querySelectorAll("button, input, textarea")];
  const prev = els.map((el) => el.disabled);
  els.forEach((el) => (el.disabled = true));
  const html = btn?.innerHTML;
  if (btn) { btn.classList.add("loading"); btn.innerHTML = `<span class="spinner sm" aria-hidden="true"></span>${esc(label)}`; }
  busy(true);
  return () => {
    form.classList.remove("is-loading");
    els.forEach((el, i) => (el.disabled = prev[i]));
    if (btn) { btn.classList.remove("loading"); btn.innerHTML = html; }
    busy(false);
  };
}

// Mensagens de erro em português claro
function friendly(e) {
  const m = String(e?.message || e || "");
  if (/failed to fetch|networkerror|load failed|network|fetch/i.test(m)) return "Sem conexão com a internet. Tente de novo.";
  if (/duplicate key|people_name_key/i.test(m)) return "Já tem alguém com esse nome na lista.";
  if (/row-level security|permission denied|multiple \(or no\) rows|0 rows/i.test(m)) return "O código da família mudou. Toque em “Sair” no rodapé e entre de novo.";
  if (/items_link_check/i.test(m)) return "Esse link da loja não parece válido.";
  if (/photo_url_check/i.test(m)) return "O link da imagem não parece válido.";
  if (/exceeded|too large|payload|maximum allowed size/i.test(m)) return "Foto grande demais. Tente outra.";
  if (/mime|invalid_mime|not supported/i.test(m)) return "Formato de foto não suportado. Use JPG ou PNG.";
  return "Ops, algo deu errado. Tente de novo.";
}

// Executa uma ação de formulário com loading, recarrega a lista e avisa
async function run(form, btn, label, action, okMsg) {
  const done = freeze(form, btn, label);
  try {
    const r = await action();
    await refresh();
    toast(okMsg);
    return r || true;
  } catch (e) {
    console.error(e);
    toast(friendly(e));
    return false;
  } finally {
    done();
  }
}

/* ---------- renderização ---------- */
function filtered() {
  const q = norm(state.q.trim());
  if (!q) return state.people.map((p) => ({ ...p, shown: p.items, matchName: false }));
  const out = [];
  for (const p of state.people) {
    const matchName = norm(p.name).includes(q);
    const hits = p.items.filter((i) => norm(`${i.title} ${i.details || ""}`).includes(q));
    if (matchName) out.push({ ...p, shown: p.items, matchName });
    else if (hits.length) out.push({ ...p, shown: hits, matchName });
  }
  // quem bate pelo nome aparece primeiro
  return out.sort((a, b) => b.matchName - a.matchName);
}

function itemHTML(i, q) {
  const c = cat(i);
  const photo = safeUrl(i.photo_url);
  const link = safeUrl(i.link);
  const p = price(i);
  return `
  <li class="item" data-item="${i.id}">
    ${photo
      ? `<button class="thumb" data-zoom="${esc(photo)}" aria-label="Ampliar foto"><img src="${esc(photo)}" alt="" loading="lazy"></button>`
      : `<span class="thumb icon cat-${c.k}" aria-hidden="true">${c.icon}</span>`}
    <div class="item-body">
      <div class="item-title">${highlight(i.title, q)}</div>
      ${i.details ? `<div class="item-details">${highlight(i.details, q)}</div>` : ""}
      ${p || link ? `<div class="item-meta">
        ${p ? `<span class="price">${p}</span>` : ""}
        ${link ? `<a class="shop" href="${esc(link)}" target="_blank" rel="noopener">${esc(host(link))}</a>` : ""}
      </div>` : ""}
    </div>
    ${link ? `<a class="go" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Ver ${esc(i.title)} na loja (${esc(host(link))})">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h17l-1.6 11.5H5.1z"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none"/></svg><span>Ver</span>
    </a>` : ""}
    <button class="icon-btn edit" data-edit-item="${i.id}" aria-label="Editar ${esc(i.title)}">
      <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>
    </button>
  </li>`;
}

function render() {
  const list = filtered();
  const q = state.q.trim();
  const total = state.people.reduce((n, p) => n + p.items.length, 0);
  $("#summary").textContent = `${state.people.length} ${state.people.length === 1 ? "pessoa" : "pessoas"} · ${total} ${total === 1 ? "sugestão" : "sugestões"} de presente`;

  $("#peopleNav").innerHTML = state.people.map((p) => {
    const av = safeUrl(p.avatar_url);
    return `<button class="jump-item" type="button" data-jump="${p.id}">
      <span class="mini-av" style="--h:${hue(p.name)}">${av ? `<img src="${esc(av)}" alt="" loading="lazy">` : esc(initials(p.name))}</span>
      <span class="jump-name">${esc(p.name)}</span>
      <span class="jump-count" aria-label="${p.items.length} sugestões">${p.items.length}</span>
    </button>`;
  }).join("");

  $("#grid").innerHTML = list.map((p) => `
    <article class="card" id="p-${p.id}" style="--h:${hue(p.name)}">
      <header class="card-head">
        ${safeUrl(p.avatar_url)
          ? `<button class="avatar has-photo" data-zoom="${esc(safeUrl(p.avatar_url))}" aria-label="Ver foto de ${esc(p.name)}"><img src="${esc(safeUrl(p.avatar_url))}" alt="" loading="lazy"></button>`
          : `<span class="avatar">${esc(initials(p.name))}</span>`}
        <div class="who">
          <h3>${highlight(p.name, p.matchName ? q : "")}</h3>
          <span class="count">${p.items.length ? `${p.items.length} ${p.items.length === 1 ? "sugestão" : "sugestões"}` : "Sem sugestões ainda"}${!p.matchName && q ? ` · mostrando ${p.shown.length}` : ""}</span>
        </div>
        <button class="icon-btn" data-edit-person="${p.id}" aria-label="Editar ${esc(p.name)}">
          <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
        </button>
      </header>
      ${p.note ? `<p class="note">“${esc(p.note)}”</p>` : ""}
      ${p.shown.length ? `<ul class="items">${p.shown.map((i) => itemHTML(i, q)).join("")}</ul>` : ""}
      <button class="add-item" data-add-item="${p.id}">+ Adicionar presente</button>
    </article>`).join("");

  const empty = $("#empty");
  empty.hidden = list.length > 0 || !q;
  if (!empty.hidden) {
    const nice = cap(q);
    $("[data-q]", empty).textContent = `“${nice}”`;
    $("[data-add-named]", empty).textContent = `+ Adicionar ${nice.length > 18 ? nice.slice(0, 17) + "…" : nice}`;
  }
  document.body.classList.toggle("no-results", !empty.hidden);
  $("#clear").hidden = !q;
}

let loaded = false, refreshSeq = 0;
async function refresh() {
  const seq = ++refreshSeq;
  busy(true);
  try {
    const people = await api.list();
    if (seq !== refreshSeq) return true; // chegou uma resposta mais nova
    state.people = people; loaded = true;
    $("#loader").hidden = true;
    render();
    return true;
  } catch (e) {
    console.error(e);
    if (loaded) toast(friendly(e));
    else loaderError(friendly(e));
    return false;
  } finally {
    busy(false);
  }
}

function loaderError(msg) {
  const l = $("#loader");
  l.hidden = false; l.classList.add("failed");
  $("p", l).textContent = msg;
  $("#retry").hidden = false;
}
function loaderReset() {
  const l = $("#loader");
  l.classList.remove("failed");
  $("p", l).textContent = "Carregando as listas…";
  $("#retry").hidden = true;
}

// Rolagem suave própria (a do navegador é rápida demais e deixa tonto):
// - perto: desliza acelerando e freando suave (0,35 s a 0,7 s);
// - longe: a lista esmaece, salta para perto da pessoa e desliza só o trecho final (~0,7 s).
// Para na hora se a pessoa tocar na tela. Com "reduzir movimento" ligado, vai direto.
// Devolve quanto tempo a rolagem vai levar (ms), para o Papai Noel voar junto.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let scrollAnim = 0, scrollStop = null;
const maxScrollY = () => document.documentElement.scrollHeight - innerHeight;
const clampY = (y) => Math.max(0, Math.min(y, maxScrollY()));
function smoothScroll(getTarget, { onStop } = {}) {
  scrollStop?.();
  const target = () => clampY(getTarget());
  const dist = Math.abs(target() - scrollY);
  if (reduceMotion.matches || dist < 4) { scrollTo(0, target()); return 0; }

  let stopped = false, timer = 0;
  const evs = ["touchstart", "wheel", "keydown"];
  const off = () => evs.forEach((ev) => removeEventListener(ev, stop));
  const stop = () => { stopped = true; cancelAnimationFrame(scrollAnim); clearTimeout(timer); document.body.classList.remove("jumping"); off(); scrollStop = null; onStop?.(); };
  evs.forEach((ev) => addEventListener(ev, stop, { passive: true }));
  scrollStop = stop;

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const run = (duration, ease) => {
    const startY = scrollY, t0 = performance.now();
    const step = (now) => {
      if (stopped) return;
      const t = Math.min(1, (now - t0) / duration);
      // alvo recalculado a cada quadro: se uma foto carregar e empurrar o card, ainda chega no lugar certo
      scrollTo(0, startY + (target() - startY) * ease(t));
      if (t < 1) scrollAnim = requestAnimationFrame(step);
      else { off(); scrollStop = null; }
    };
    scrollAnim = requestAnimationFrame(step);
  };

  const NEAR = 600; // trecho final que desliza
  if (dist > 1400) {
    const dir = Math.sign(target() - scrollY);
    document.body.classList.add("jumping");
    timer = setTimeout(() => {
      if (stopped) return;
      scrollTo(0, target() - dir * NEAR);
      document.body.classList.remove("jumping");
      run(600, easeOut);
    }, 120);
    return 720;
  }
  const d = Math.min(700, 350 + dist * 0.3);
  run(d, easeInOut);
  return d;
}

// Papai Noel no trenó (desenho no estilo do site; olhando para a direita)
const SANTA_SVG = `<svg viewBox="0 0 156 78" aria-hidden="true">
  <g stroke="#2b2a3a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M70 38c18-10 34-12 52-6" fill="none" stroke-width="2"/>
    <path d="M110 52l-4 14M118 52l2 14M128 50l-2 15M134 48l5 14" fill="none"/>
    <ellipse cx="122" cy="45" rx="17" ry="9" fill="#a8652f"/>
    <path d="M134 40l6-12" fill="none" stroke-width="7"/><path d="M134 40l6-12" fill="none" stroke="#a8652f" stroke-width="3.5"/>
    <path d="M140 22l-4-10M138 16l-6-2M144 22l4-11M146 15l5-1" fill="none" stroke-width="2.5"/>
    <ellipse cx="143" cy="27" rx="8" ry="6" fill="#a8652f"/>
    <circle cx="151" cy="28" r="3.6" fill="#ef4b4b"/>
    <circle cx="142" cy="25" r="1.3" fill="#2b2a3a" stroke="none"/>
    <circle cx="20" cy="30" r="11" fill="#2e9e5b"/>
    <path d="M24 40q3-24 18-24t18 24z" fill="#ef4b4b"/>
    <circle cx="42" cy="14" r="8" fill="#f6cfae"/>
    <path d="M34 15q8 13 16 0q-3 6-8 6t-8-6z" fill="#fff" stroke-width="2.5"/>
    <path d="M34 11q6-14 18-7l-3 7z" fill="#ef4b4b"/>
    <rect x="33" y="8.5" width="18" height="5" rx="2.5" fill="#fff" stroke-width="2.5"/>
    <circle cx="53" cy="4" r="3.2" fill="#fff" stroke-width="2.5"/>
    <path d="M56 26l10-9" fill="none" stroke-width="6"/><path d="M56 26l10-9" fill="none" stroke="#ef4b4b" stroke-width="3"/>
    <circle cx="67" cy="16" r="3.4" fill="#fff" stroke-width="2.5"/>
    <path d="M8 36h58q9 0 9 11v3q0 9-11 9H20q-14 0-14-12z" fill="#ef4b4b"/>
    <path d="M12 44h56" fill="none" stroke="#ffd23f" stroke-width="4"/>
    <path d="M20 59v8M58 59v8" fill="none"/>
    <path d="M4 68h66q10 0 13-9" fill="none" stroke-width="3.5"/>
  </g>
</svg>`;

// Voa da lateral da tela até pousar no card, no mesmo tempo da rolagem; o card remexe e ele vai embora
let santaNow = null;
function flySanta(card, duration) {
  santaNow?.remove();
  const W = innerWidth, H = innerHeight;
  const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const finalY = clampY(scrollY + card.getBoundingClientRect().top - pad);
  const r = card.getBoundingClientRect();
  const cardTop = r.top - (finalY - scrollY); // onde o card vai estar na tela quando a rolagem acabar
  const size = Math.min(175, W * 0.44), h = size / 2;
  const landX = r.left + Math.min(r.width * 0.62, r.width - size * 0.45);
  const landY = cardTop + 4;

  const s = document.createElement("div");
  s.className = "santa"; s.innerHTML = SANTA_SVG;
  s.style.width = size + "px"; s.style.height = h + "px";
  document.body.appendChild(s);
  santaNow = s;
  const at = (x, y, rot) => `translate(${x - size / 2}px, ${y - h}px) rotate(${rot}deg)`;

  const fly = Math.max(duration, 520); // mesmo com rolagem curtinha, dá tempo de ver o voo
  const startY = Math.max(40, Math.min(cardTop - 140, H * 0.22));
  const flight = s.animate([
    { transform: at(W + size, startY - 20, -14), offset: 0 },
    { transform: at(W * 0.78, startY + 6, -6), offset: 0.35 },
    { transform: at((W * 0.78 + landX) / 2, (startY + landY) / 2 - 18, 4), offset: 0.7 },
    { transform: at(landX, landY, 0), offset: 1 },
  ], { duration: fly, easing: "cubic-bezier(.33,.0,.25,1)", fill: "forwards" });

  const remexe = setTimeout(() => {
    card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
  }, Math.max(0, fly - 90)); // começa um tiquinho antes do pouso: movimento contínuo

  flight.onfinish = () => {
    if (santaNow !== s) return;
    const leave = s.animate([
      { transform: at(landX, landY, 0) },
      { transform: at(landX - size * 0.4, landY - 14, 8), offset: 0.25 },
      { transform: at(-size * 1.2, Math.max(-h, landY - 170), 16) },
    ], { duration: 520, delay: 160, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" });
    leave.onfinish = () => { s.remove(); if (santaNow === s) santaNow = null; };
  };
  s.cancelFlight = () => { clearTimeout(remexe); flight.cancel(); s.remove(); santaNow = null; };
}

function jumpTo(id) {
  const el = document.getElementById("p-" + id);
  if (!el) return;
  const pad = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0; // altura da barra fixa
  santaNow?.cancelFlight?.();
  const flySoon = !reduceMotion.matches && !!el.animate;
  if (flySoon) {
    // calcula o voo antes de começar a rolar (posição final do card)
    const dur = (() => { const d = Math.abs(clampY(scrollY + el.getBoundingClientRect().top - pad()) - scrollY); return d < 4 ? 0 : d > 1400 ? 720 : Math.min(700, 350 + d * 0.3); })();
    flySanta(el, dur);
  }
  smoothScroll(() => scrollY + el.getBoundingClientRect().top - pad(), { onStop: () => santaNow?.cancelFlight?.() });
  if (!flySoon) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
}

/* ---------- diálogos ---------- */
const findPerson = (id) => state.people.find((p) => p.id === id);
const findItem = (id) => { for (const p of state.people) { const i = p.items.find((x) => x.id === id); if (i) return i; } };

let avatarSeq = 0; // invalida upload da foto de perfil se a janela for reaberta no meio
function setAvatarPreview(url) {
  const f = $("#personForm"), box = $("[data-avatar-preview]", f), u = safeUrl(url);
  const name = f.name.value.trim();
  box.innerHTML = u ? `<img src="${esc(u)}" alt="">` : `<span>${name ? esc(initials(name)) : "📷"}</span>`;
  $("[data-remove-avatar]", f).hidden = !u;
}

function openPerson(p, prefill = "") {
  const dlg = $("#personDlg"), f = $("#personForm");
  avatarSeq++;
  delete f.dataset.uploading;
  $("[type=submit]", f).disabled = false;
  f.reset(); f.dataset.id = p?.id || "";
  f.dataset.avatar = p?.avatar_url || ""; f.dataset.avatarOrig = f.dataset.avatar;
  $("[data-title]", f).textContent = p ? "Editar pessoa" : "Nova pessoa";
  f.name.value = p?.name || prefill; f.note.value = p?.note || "";
  setAvatarPreview(f.dataset.avatar);
  dlg.showModal(); // sem foco em campo: o teclado só abre quando a pessoa tocar
}

function setPreview(url) {
  const f = $("#itemForm"), box = $("[data-preview]", f), u = safeUrl(url);
  box.innerHTML = u ? `<img src="${esc(u)}" alt="">` : "<span>Sem foto</span>";
  $("[data-remove-photo]", f).hidden = !u;
}

let uploadSeq = 0; // invalida upload de foto se o formulário for reaberto no meio
function openItem(personId, item) {
  const dlg = $("#itemDlg"), f = $("#itemForm"), p = findPerson(personId);
  if (!p) return;
  uploadSeq++;
  delete f.dataset.uploading;
  $("[type=submit]", f).disabled = false;
  f.reset(); f.dataset.id = item?.id || ""; f.dataset.person = personId; f.dataset.photo = item?.photo_url || "";
  $("[data-title]", f).textContent = item ? "Editar presente" : "Novo presente";
  $("[data-for]", f).textContent = `Para ${p.name}`;
  for (const k of ["title", "details", "link", "price_min", "price_max"]) f[k].value = item?.[k] ?? "";
  setPreview(item?.photo_url);
  $("[data-delete]", f).hidden = !item;
  dlg.showModal();
}

function wireDialogs() {
  document.querySelectorAll("dialog.sheet").forEach((d) => {
    const loading = () => !!d.querySelector(".is-loading");
    d.addEventListener("click", (e) => { if (e.target === d && d.id !== "gate" && !loading()) d.close(); });
    d.addEventListener("cancel", (e) => { if (d.id === "gate" || loading()) e.preventDefault(); });
    d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { if (!loading()) d.close(); }));
  });

  // Pessoa (excluir pessoa só pelo banco, de propósito)
  const pf = $("#personForm");
  pf.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (pf.classList.contains("is-loading") || pf.dataset.uploading) return;
    const name = pf.name.value.trim(); if (!name) return;
    const id = pf.dataset.id || null;
    const dup = state.people.find((p) => norm(p.name) === norm(name) && p.id !== id);
    if (dup) return toast(`${dup.name} já está na lista`);
    const row = await run(pf, $("[type=submit]", pf), "Salvando…",
      () => {
        const data = { id, name, note: pf.note.value };
        if (pf.dataset.avatar !== pf.dataset.avatarOrig) data.avatar_url = pf.dataset.avatar || null;
        return api.savePerson(data);
      },
      id ? "Salvo ✨" : `${name} entrou na lista 🎄`);
    if (!row) return;
    $("#personDlg").close();
    if (!id && row.id) setTimeout(() => jumpTo(row.id), 50);
  });
  const pSubmit = $("[type=submit]", pf);
  pf.name.addEventListener("input", () => { if (!pf.dataset.avatar && !pf.dataset.uploading) setAvatarPreview(""); });
  $("[data-remove-avatar]", pf).addEventListener("click", () => { pf.dataset.avatar = ""; setAvatarPreview(""); });
  pf.addEventListener("change", async (e) => { // "Escolher foto"
    if (!e.target.matches("[data-avatar-file]")) return;
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const mine = ++avatarSeq;
    $("[data-avatar-preview]", pf).innerHTML = '<span class="spinner"></span>';
    pf.dataset.uploading = "1"; pSubmit.disabled = true; busy(true);
    try {
      const url = await api.uploadPhoto(file, 480);
      if (mine !== avatarSeq) return;
      pf.dataset.avatar = url; setAvatarPreview(url);
      toast("Foto pronta 📸");
    } catch (err) {
      console.error(err);
      if (mine === avatarSeq) { toast(friendly(err)); setAvatarPreview(pf.dataset.avatar); }
    } finally {
      busy(false);
      if (mine === avatarSeq) { delete pf.dataset.uploading; pSubmit.disabled = false; }
    }
  });

  // Presente
  const f = $("#itemForm");
  const submitBtn = $("[type=submit]", f);
  $("[data-remove-photo]", f).addEventListener("click", () => { f.dataset.photo = ""; setPreview(""); });
  f.addEventListener("change", async (e) => { // "Escolher foto"
    if (!e.target.matches("[data-file]")) return;
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const mine = ++uploadSeq;
    const box = $("[data-preview]", f);
    box.innerHTML = '<span class="spinner"></span><small>Enviando foto…</small>';
    f.dataset.uploading = "1"; submitBtn.disabled = true; busy(true);
    try {
      const url = await api.uploadPhoto(file);
      if (mine !== uploadSeq) return; // formulário foi fechado/reaberto
      f.dataset.photo = url; setPreview(url);
      toast("Foto pronta 📸");
    } catch (err) {
      console.error(err);
      if (mine === uploadSeq) { toast(friendly(err)); setPreview(f.dataset.photo); }
    } finally {
      busy(false);
      if (mine === uploadSeq) { delete f.dataset.uploading; submitBtn.disabled = false; }
    }
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (f.classList.contains("is-loading") || f.dataset.uploading) return;
    const it = { id: f.dataset.id || null, person_id: f.dataset.person, photo_url: f.dataset.photo };
    for (const k of ["title", "details", "link", "price_min", "price_max"]) it[k] = f[k].value;
    if (!it.title.trim()) return;
    if (it.link && !/^https?:\/\//i.test(it.link.trim())) it.link = "https://" + it.link.trim();
    if (it.price_min && it.price_max && +it.price_min > +it.price_max) [it.price_min, it.price_max] = [it.price_max, it.price_min];
    const ok = await run(f, submitBtn, "Salvando…", () => api.saveItem(it), it.id ? "Presente atualizado ✨" : "Presente adicionado 🎁");
    if (ok) $("#itemDlg").close();
  });
  const delBtn = $("[data-delete]", f);
  delBtn.addEventListener("click", async () => {
    if (f.classList.contains("is-loading") || !f.dataset.id) return;
    if (!confirm("Excluir este presente?")) return;
    const ok = await run(f, delBtn, "Excluindo…", () => api.deleteItem(f.dataset.id), "Presente removido");
    if (ok) $("#itemDlg").close();
  });

  $("#lightbox").addEventListener("click", () => $("#lightbox").close());
}

/* ---------- eventos ---------- */
function wireEvents() {
  const q = $("#q");
  q.addEventListener("input", () => { state.q = q.value; render(); });
  $("#clear").addEventListener("click", () => { q.value = ""; state.q = ""; render(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== q && !document.querySelector("dialog[open]")) { e.preventDefault(); q.focus(); }
  });

  $("#addPerson").addEventListener("click", () => { if (loaded) openPerson(null); });
  $("#retry").addEventListener("click", () => { loaderReset(); refresh(); });
  $("[data-clear-search]").addEventListener("click", () => { q.value = ""; state.q = ""; render(); });
  $("[data-add-named]").addEventListener("click", () => { if (loaded) openPerson(null, cap(state.q).slice(0, 60)); });

  // lista de nomes: abre/fecha no botão, fecha ao escolher, tocar fora ou apertar Esc
  const jumpBtn = $("#jumpBtn"), jumpList = $("#peopleNav");
  // altura da lista = espaço que sobra na tela abaixo do botão (o resto rola dentro da lista)
  const fitJump = () => {
    if (jumpList.hidden) return;
    const room = innerHeight - jumpBtn.getBoundingClientRect().bottom - 16;
    jumpList.style.maxHeight = Math.max(160, Math.min(room, 520)) + "px";
  };
  const setJump = (open) => {
    jumpList.hidden = !open; jumpBtn.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("jump-open", open);
    if (!open) return;
    jumpList.scrollTop = 0;
    // pouco espaço embaixo (página no topo): sobe até a barra grudar no alto, aí a lista ganha espaço
    if (innerHeight - jumpBtn.getBoundingClientRect().bottom < 360) {
      const bar = $("#toolbar"), y = scrollY + bar.getBoundingClientRect().top;
      if (bar.getBoundingClientRect().top > 0) { smoothScroll(() => y); setTimeout(fitJump, 720); }
    }
    fitJump();
  };
  addEventListener("scroll", fitJump, { passive: true });
  addEventListener("resize", fitJump);
  jumpBtn.addEventListener("click", () => setJump(jumpList.hidden));
  document.addEventListener("click", (e) => { if (!jumpList.hidden && !e.target.closest("#jump")) setJump(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !jumpList.hidden) setJump(false); });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-jump],[data-edit-person],[data-add-item],[data-edit-item],[data-zoom]");
    if (!t) return;
    if (t.dataset.jump) {
      setJump(false);
      if (state.q) { state.q = ""; q.value = ""; render(); }
      jumpTo(t.dataset.jump);
    }
    if (t.dataset.editPerson) { const p = findPerson(t.dataset.editPerson); if (p) openPerson(p); }
    if (t.dataset.addItem) openItem(t.dataset.addItem, null);
    if (t.dataset.editItem) { const it = findItem(t.dataset.editItem); if (it) openItem(it.person_id, it); }
    if (t.dataset.zoom) { const lb = $("#lightbox"); $("img", lb).src = t.dataset.zoom; lb.showModal(); }
  });

  $("#lock").addEventListener("click", () => { forgetCode(); location.reload(); });

  // atualiza quando alguém volta para a aba (pega mudanças dos outros)
  document.addEventListener("visibilitychange", () => {
    if (loaded && !document.hidden && !document.querySelector("dialog[open]")) refresh();
  });
}

// Barra de busca fixa: sombra quando grudada e compensação no "pular para pessoa"
function wireToolbar() {
  const bar = $("#toolbar");
  const fit = () => (document.documentElement.style.scrollPaddingTop = bar.offsetHeight + 44 + "px");
  fit(); addEventListener("resize", fit);
  new ResizeObserver(fit).observe(bar);
  addEventListener("scroll", () => bar.classList.toggle("stuck", bar.getBoundingClientRect().top <= 0 && scrollY > 0), { passive: true });
}

/* ---------- início ---------- */
async function unlock() {
  const saved = getSavedCode();
  if (saved) {
    busy(true);
    const ok = await api.unlock(saved).catch(() => false);
    busy(false);
    if (ok) return;
  }
  const gate = $("#gate"), f = $("#gateForm"), err = $("#gateErr");
  gate.showModal();
  await new Promise((resolve) => {
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (f.classList.contains("is-loading")) return;
      const code = f.code.value.trim(); if (!code) return;
      err.hidden = true;
      const done = freeze(f, $("[type=submit]", f), "Entrando…");
      let ok = false, problem = null;
      try { ok = await api.unlock(code); } catch (x) { console.error(x); problem = x; }
      done();
      if (ok) { gate.close(); resolve(); return; }
      err.textContent = problem ? friendly(problem) : "Código incorreto. Tente de novo.";
      err.hidden = false;
    });
  });
}

// Sempre a versão mais nova do site (ver sw.js)
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e));

(async function main() {
  document.title = `${TITULO} ${ANO}`;
  $("#title").textContent = TITULO;
  $("#eyebrow").textContent = `Lista de sugestões · Natal ${ANO}`;
  $("#demoBanner").hidden = !DEMO;
  wireDialogs(); wireEvents(); wireToolbar();
  if (!DEMO) { await unlock(); $("#lock").hidden = false; }
  await refresh();
})();
