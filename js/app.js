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

const CATS = [
  { k: "calcado", label: "Calçado", icon: "👟", re: /t[eê]nis|chinelo|sapato|sand[aá]lia|cal[cç]ado|bota/ },
  { k: "roupa", label: "Roupa", icon: "👕", re: /roupa|blusa|camis|cal[cç]a|bermuda|short|biqu|vestido|saia|jaqueta|moletom|meia/ },
  { k: "beleza", label: "Perfume", icon: "🌸", re: /perfume|body splash|splash|maquiagem|creme/ },
  { k: "acessorio", label: "Acessório", icon: "💍", re: /brinco|anel|an[eé]is|colar|pulseira|rel[oó]gio|bolsa|[oó]culos/ },
  { k: "papelaria", label: "Papelaria", icon: "📒", re: /caderno|agenda|livro|caneta/ },
  { k: "brinquedo", label: "Brinquedo", icon: "🏎️", re: /carrinho|pista|brinquedo|boneca|lego|jogo/ },
];
const cat = (t) => CATS.find((c) => c.re.test(norm(t))) || { k: "outro", label: "", icon: "🎁" };

const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
function hue(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
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
  const c = cat(i.title);
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
        ${link ? `<a class="shop" href="${esc(link)}" target="_blank" rel="noopener">${esc(host(link))} ↗</a>` : ""}
      </div>` : ""}
    </div>
    <button class="icon-btn edit" data-edit-item="${i.id}" aria-label="Editar ${esc(i.title)}">
      <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>
    </button>
  </li>`;
}

function render() {
  const list = filtered();
  const q = state.q.trim();
  const total = state.people.reduce((n, p) => n + p.items.length, 0);
  $("#summary").textContent = `${state.people.length} pessoas · ${total} sugestões de presente`;

  $("#peopleNav").innerHTML = state.people.map((p) =>
    `<button class="chip ${norm(q) && norm(p.name).includes(norm(q)) ? "on" : ""}" data-jump="${p.id}">${esc(p.name)}</button>`).join("");

  $("#grid").innerHTML = list.map((p) => `
    <article class="card" id="p-${p.id}" style="--h:${hue(p.name)}">
      <header class="card-head">
        <span class="avatar">${esc(initials(p.name))}</span>
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
  $("span", empty).textContent = q;
  $("#clear").hidden = !q;
}

async function refresh() {
  try { state.people = await api.list(); render(); }
  catch (e) { console.error(e); toast("Não consegui carregar as listas 😕"); }
}

/* ---------- diálogos ---------- */
const findPerson = (id) => state.people.find((p) => p.id === id);
const findItem = (id) => { for (const p of state.people) { const i = p.items.find((x) => x.id === id); if (i) return i; } };

function openPerson(p) {
  const dlg = $("#personDlg"), f = $("#personForm");
  f.reset(); f.dataset.id = p?.id || "";
  $("[data-title]", f).textContent = p ? "Editar pessoa" : "Nova pessoa";
  f.name.value = p?.name || ""; f.note.value = p?.note || "";
  $("[data-delete]", f).hidden = !p;
  dlg.showModal(); if (!p) f.name.focus();
}

function setPreview(url) {
  const f = $("#itemForm"), box = $("[data-preview]", f), u = safeUrl(url);
  box.innerHTML = u ? `<img src="${esc(u)}" alt="">` : "<span>Sem foto</span>";
  $("[data-remove-photo]", f).hidden = !u;
}

function openItem(personId, item) {
  const dlg = $("#itemDlg"), f = $("#itemForm"), p = findPerson(personId);
  f.reset(); f.dataset.id = item?.id || ""; f.dataset.person = personId; f.dataset.photo = item?.photo_url || "";
  $("[data-title]", f).textContent = item ? "Editar presente" : "Novo presente";
  $("[data-for]", f).textContent = `Para ${p.name}`;
  for (const k of ["title", "details", "link", "price_min", "price_max"]) f[k].value = item?.[k] ?? "";
  f.photo_url.value = item?.photo_url?.startsWith("data:") ? "" : item?.photo_url || "";
  setPreview(item?.photo_url);
  $("[data-delete]", f).hidden = !item;
  dlg.showModal(); if (!item) f.title.focus();
}

function wireDialogs() {
  document.querySelectorAll("dialog.sheet").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d && d.id !== "gate") d.close(); });
    d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => d.close()));
  });
  $("#gate").addEventListener("cancel", (e) => e.preventDefault());

  // Pessoa
  const pf = $("#personForm");
  pf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = pf.name.value.trim(); if (!name) return;
    const dup = state.people.find((p) => norm(p.name) === norm(name) && p.id !== pf.dataset.id);
    if (dup) return toast(`${dup.name} já está na lista`);
    await guard(api.savePerson({ id: pf.dataset.id || null, name, note: pf.note.value }), pf.dataset.id ? "Salvo" : `${name} adicionado(a) 🎄`);
    $("#personDlg").close();
  });
  $("[data-delete]", pf).addEventListener("click", async () => {
    const p = findPerson(pf.dataset.id);
    if (!confirm(`Excluir ${p.name} e todas as sugestões?`)) return;
    await guard(api.deletePerson(p.id), `${p.name} removido(a)`);
    $("#personDlg").close();
  });

  // Presente
  const f = $("#itemForm");
  f.photo_url.addEventListener("input", () => { f.dataset.photo = f.photo_url.value; setPreview(f.photo_url.value); });
  $("[data-remove-photo]", f).addEventListener("click", () => { f.dataset.photo = ""; f.photo_url.value = ""; setPreview(""); });
  $("[data-file]", f).addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const box = $("[data-preview]", f); box.innerHTML = '<span class="spinner"></span>';
    try { const url = await api.uploadPhoto(file); f.dataset.photo = url; f.photo_url.value = url.startsWith("data:") ? "" : url; setPreview(url); }
    catch (err) { console.error(err); toast("Não consegui enviar a foto"); setPreview(f.dataset.photo); }
    e.target.value = "";
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const it = { id: f.dataset.id || null, person_id: f.dataset.person, photo_url: f.dataset.photo };
    for (const k of ["title", "details", "link", "price_min", "price_max"]) it[k] = f[k].value;
    if (it.link && !/^https?:\/\//i.test(it.link)) it.link = "https://" + it.link;
    if (it.price_min && it.price_max && +it.price_min > +it.price_max) [it.price_min, it.price_max] = [it.price_max, it.price_min];
    await guard(api.saveItem(it), it.id ? "Presente atualizado" : "Presente adicionado 🎁");
    $("#itemDlg").close();
  });
  $("[data-delete]", f).addEventListener("click", async () => {
    if (!confirm("Excluir este presente?")) return;
    await guard(api.deleteItem(f.dataset.id), "Presente removido");
    $("#itemDlg").close();
  });

  $("#lightbox").addEventListener("click", () => $("#lightbox").close());
}

async function guard(promise, okMsg) {
  try { await promise; toast(okMsg); await refresh(); }
  catch (e) { console.error(e); toast("Ops, algo deu errado: " + e.message); throw e; }
}

/* ---------- eventos ---------- */
function wireEvents() {
  const q = $("#q");
  q.addEventListener("input", () => { state.q = q.value; render(); });
  $("#clear").addEventListener("click", () => { q.value = ""; state.q = ""; render(); q.focus(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== q && !document.querySelector("dialog[open]")) { e.preventDefault(); q.focus(); }
  });

  $("#addPerson").addEventListener("click", () => openPerson(null));

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-jump],[data-edit-person],[data-add-item],[data-edit-item],[data-zoom]");
    if (!t) return;
    if (t.dataset.jump) {
      if (state.q) { state.q = ""; q.value = ""; render(); }
      const el = document.getElementById("p-" + t.dataset.jump);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      el?.classList.remove("flash"); void el?.offsetWidth; el?.classList.add("flash");
    }
    if (t.dataset.editPerson) openPerson(findPerson(t.dataset.editPerson));
    if (t.dataset.addItem) openItem(t.dataset.addItem, null);
    if (t.dataset.editItem) { const it = findItem(t.dataset.editItem); openItem(it.person_id, it); }
    if (t.dataset.zoom) { const lb = $("#lightbox"); $("img", lb).src = t.dataset.zoom; lb.showModal(); }
  });

  $("#lock").addEventListener("click", () => { forgetCode(); location.reload(); });

  // atualiza quando alguém volta para a aba (pega mudanças dos outros)
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !document.querySelector("dialog[open]")) refresh(); });
}

// Barra de busca fixa: sombra quando grudada e compensação no "pular para pessoa"
function wireToolbar() {
  const bar = $("#toolbar");
  const fit = () => (document.documentElement.style.scrollPaddingTop = bar.offsetHeight + 12 + "px");
  fit(); addEventListener("resize", fit);
  new ResizeObserver(fit).observe(bar);
  addEventListener("scroll", () => bar.classList.toggle("stuck", bar.getBoundingClientRect().top <= 0 && scrollY > 0), { passive: true });
}

/* ---------- início ---------- */
async function unlock() {
  const saved = getSavedCode();
  if (saved && (await api.unlock(saved).catch(() => false))) return;
  const gate = $("#gate"), f = $("#gateForm");
  gate.showModal();
  await new Promise((resolve) => {
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = await api.unlock(f.code.value.trim()).catch((err) => { console.error(err); return false; });
      if (ok) { gate.close(); resolve(); } else { $("#gateErr").hidden = false; f.code.select(); }
    });
  });
}

(async function main() {
  document.title = `${TITULO} ${ANO}`;
  $("#title").textContent = TITULO;
  $("#eyebrow").textContent = `Lista de sugestões · Natal ${ANO}`;
  $("#demoBanner").hidden = !DEMO;
  wireDialogs(); wireEvents(); wireToolbar();
  if (!DEMO) { await unlock(); $("#lock").hidden = false; }
  await refresh();
})();
