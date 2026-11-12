# 🎄 Lista de Natal da Família

Um site simples e elegante para a família inteira montar a lista de sugestões de presente — sem precisar ficar rolando o grupo do WhatsApp.

- **Uma lista por pessoa**, com recado opcional (“me surpreenda!”)
- **Busca** por pessoa ou por presente (“perfume”, “40”, “Débora”…), com atalhos de nome no topo
- **Presentes com link da loja, foto e faixa de preço**
- **Fotos pelo celular** (redimensionadas automaticamente antes de enviar)
- **Código da família**: só quem sabe o código vê e edita
- Funciona bem no celular, com tema claro e escuro
- Sem build, sem framework: HTML + CSS + JS puro, hospedado de graça no GitHub Pages, dados no Supabase (plano grátis)

> Sem configurar nada, o site abre em **modo demonstração** (dados só no seu navegador), já com a lista atual da família.

---

## Como colocar no ar (≈10 minutos)

### 1. Supabase (banco de dados)

1. Crie uma conta em [supabase.com](https://supabase.com) e um **New project** (plano Free).
2. Abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql), **troque `TROQUE-ESTE-CODIGO`** pelo código da família (ex.: `panetone2026`) e clique em **Run**.
3. Em outra query, cole [`supabase/seed.sql`](supabase/seed.sql) e rode — isso carrega a lista que já estava no WhatsApp. (Rode só uma vez, senão os presentes duplicam.)
4. Vá em **Project Settings → API** e copie a **Project URL** e a chave **anon public**.

### 2. Configurar o site

Edite o [`config.js`](config.js):

```js
export const SUPABASE_URL = "https://xxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
export const TITULO = "Natal da Família";
export const ANO = 2026;
```

A chave `anon` é pública por natureza (vai para o navegador de qualquer forma). Quem protege os dados é o **código da família**, checado pelo banco (Row Level Security).

### 3. GitHub Pages (hospedagem)

```bash
git remote add origin https://github.com/SEU-USUARIO/lista-natal.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / root → Save**.
Em ~1 minuto o site estará em `https://SEU-USUARIO.github.io/lista-natal/`. Mande o link + o código no grupo e pronto 🎁

---

## Rodar localmente

```bash
npm run dev      # abre em http://localhost:5173
```

(Precisa de um servidor porque o site usa módulos JS — abrir o `index.html` direto pelo arquivo não funciona.)

## Estrutura

```
index.html            página
styles.css            visual
config.js             URL/chave do Supabase, título e ano
js/app.js             interface (busca, cards, formulários)
js/api.js             dados: Supabase ou modo demonstração
data/seed.js          lista inicial da família
scripts/gerar-seed.mjs  gera supabase/seed.sql a partir do data/seed.js
supabase/schema.sql   tabelas, segurança e bucket de fotos
supabase/seed.sql     carga inicial
```

## Dicas

- **Trocar o código da família:** rode no SQL Editor
  `update private.settings set value = 'novo-codigo' where key = 'family_code';`
  Todo mundo vai precisar digitar o código novo (há um botão “Sair” no rodapé).
- **Atualizar a carga inicial:** edite `data/seed.js` e rode `npm run seed`.
- **Limite de fotos:** 5 MB por imagem (JPG, PNG ou WebP). O site já reduz as fotos do celular antes de enviar.
- **Atalho:** aperte `/` no computador para ir direto na busca.
- **Segurança, sendo sincero:** o código da família protege a leitura e edição das listas. O envio de fotos para o bucket aceita qualquer requisição com a chave anon — suficiente para uma lista de família, mas não guarde nada sensível ali.
