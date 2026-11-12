// Camada de dados: Supabase quando configurado, senão modo demonstração (localStorage).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { SEED } from "../data/seed.js";

const CODE_KEY = "natal.familyCode";
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

export const getSavedCode = () => safeGet(CODE_KEY);
export const forgetCode = () => safeSet(CODE_KEY, null);

/* ---------------- Supabase ---------------- */
let sb = null;
async function client(code) {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { "x-family-code": code || "" } },
  });
  return sb;
}

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

const remote = {
  async unlock(code) {
    const c = await client(code);
    const ok = must(await c.rpc("check_family_code", { code }));
    if (ok) safeSet(CODE_KEY, code);
    return !!ok;
  },
  async list() {
    const people = must(await sb.from("people").select("*").order("name"));
    const items = must(await sb.from("items").select("*").order("created_at"));
    return people.map((p) => ({ ...p, items: items.filter((i) => i.person_id === p.id) }));
  },
  async savePerson(p) {
    const row = { name: p.name.trim(), note: p.note?.trim() || null };
    if ("avatar_url" in p) row.avatar_url = p.avatar_url || null; // só envia quando a foto mudou
    if (p.id) return must(await sb.from("people").update(row).eq("id", p.id).select().single());
    return must(await sb.from("people").insert(row).select().single());
  },
  async saveItem(i) {
    const row = pickItem(i);
    if (i.id) return must(await sb.from("items").update(row).eq("id", i.id).select().single());
    return must(await sb.from("items").insert(row).select().single());
  },
  async deleteItem(id) { must(await sb.from("items").delete().eq("id", id)); },
  async uploadPhoto(file, max = 1200) {
    const blob = await shrink(file, max);
    const path = `${crypto.randomUUID()}.jpg`;
    must(await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg" }));
    return sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
  },
};

/* ---------------- Demonstração ---------------- */
const DEMO_KEY = "natal.demoData";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
function demoLoad() {
  const raw = safeGet(DEMO_KEY);
  if (raw) try { return JSON.parse(raw); } catch {}
  const data = SEED.map((p) => {
    const id = uid();
    return { id, name: p.name, note: p.note || null,
      items: p.items.map((it) => ({ id: uid(), person_id: id, title: it.title, details: it.details || null,
        link: null, photo_url: null, price_min: null, price_max: null })) };
  });
  safeSet(DEMO_KEY, JSON.stringify(data));
  return data;
}
let mem = null;
const db = () => (mem ??= demoLoad());
const persist = () => safeSet(DEMO_KEY, JSON.stringify(mem));

const demo = {
  async unlock() { return true; },
  async list() { return structuredClone(db()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")); },
  async savePerson(p) {
    const list = db();
    let row;
    const data = { name: p.name.trim(), note: p.note?.trim() || null };
    if ("avatar_url" in p) data.avatar_url = p.avatar_url || null;
    if (p.id) { row = list.find((x) => x.id === p.id); Object.assign(row, data); }
    else list.push((row = { id: uid(), avatar_url: null, ...data, items: [] }));
    persist();
    return { id: row.id, name: row.name, note: row.note, avatar_url: row.avatar_url };
  },
  async saveItem(i) {
    const person = db().find((p) => p.id === i.person_id);
    const row = { ...pickItem(i), id: i.id || uid() };
    const idx = person.items.findIndex((x) => x.id === i.id);
    idx >= 0 ? (person.items[idx] = row) : person.items.push(row);
    persist();
  },
  async deleteItem(id) { db().forEach((p) => (p.items = p.items.filter((i) => i.id !== id))); persist(); },
  async uploadPhoto(file, max = 600) {
    const blob = await shrink(file, Math.min(max, 600));
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  },
};

function pickItem(i) {
  const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
  return {
    person_id: i.person_id,
    title: i.title.trim(),
    details: i.details?.trim() || null,
    link: i.link?.trim() || null,
    photo_url: i.photo_url?.trim() || null,
    price_min: num(i.price_min),
    price_max: num(i.price_max),
  };
}

// Reduz a foto antes de enviar (celular tira fotos enormes)
async function shrink(file, max = 1200) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
}

export const api = DEMO ? demo : remote;
