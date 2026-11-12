// Gera supabase/seed.sql a partir de data/seed.js
// Uso: node scripts/gerar-seed.mjs
import { writeFileSync } from "node:fs";
import { SEED } from "../data/seed.js";

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
let sql = "-- Lista inicial da família (gerado por scripts/gerar-seed.mjs)\n-- Rode DEPOIS do schema.sql\n\n";

sql += "insert into public.people (name, note) values\n" +
  SEED.map((p) => `  (${q(p.name)}, ${q(p.note)})`).join(",\n") +
  "\non conflict do nothing;\n\n";

const rows = SEED.flatMap((p) => p.items.map((i) => `  (${q(p.name)}, ${q(i.title)}, ${q(i.details)})`));
sql += "insert into public.items (person_id, title, details)\nselect p.id, v.title, v.details\nfrom (values\n" +
  rows.join(",\n") + "\n) as v(person, title, details)\njoin public.people p on lower(p.name) = lower(v.person);\n";

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql gerado: ${SEED.length} pessoas, ${rows.length} presentes`);
