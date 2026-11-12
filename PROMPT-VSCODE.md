Estou na pasta `~/Documentos/lucas-projects/lista-natal`, um site estático (HTML/CSS/JS puro, sem build) de lista de presentes de Natal da família, com dados no Supabase. Quero publicar no GitHub e no GitHub Pages. Faça o seguinte, passo a passo, e me mostre o resultado de cada comando:

1. **Conferir o projeto**: liste os arquivos e leia o `README.md` para entender a estrutura. Não altere nenhum código do app.
2. **Segurança antes do commit**: verifique se o `config.js` tem apenas `SUPABASE_URL` e a chave **anon** (pública, pode ir pro repo). Se encontrar qualquer chave `service_role`, senha ou token, PARE e me avise. Garanta que o `.gitignore` tenha `node_modules/` e `.DS_Store`.
3. **Git**: se ainda não for um repositório, rode `git init -b main`. Faça `git add -A` e um commit com a mensagem `feat: lista de Natal da família (site + Supabase)`. Se já houver commits, só commite o que estiver pendente.
4. **GitHub**: use o GitHub CLI (`gh`). Se `gh auth status` falhar, rode `gh auth login` e me espere concluir o login no navegador. Depois crie o repositório **público** `lista-natal` na minha conta e faça o push:
   `gh repo create lista-natal --public --source=. --remote=origin --push --description "Lista de sugestões de Natal da família 🎄"`
   (Se eu não tiver o `gh` instalado, me diga como instalar no Linux ou faça via `git remote add origin` + `git push -u origin main`, me pedindo para criar o repo vazio no site.)
5. **GitHub Pages**: ative o Pages servindo a branch `main`, pasta raiz:
   `gh api -X POST repos/{owner}/lista-natal/pages -f "source[branch]=main" -f "source[path]=/"`
   (se der erro dizendo que já existe, tudo bem). Depois consulte `gh api repos/{owner}/lista-natal/pages` até o status ficar `built` e me mostre a URL final (`https://<usuario>.github.io/lista-natal/`).
6. **Teste rápido**: abra a URL e confirme que a página carrega (o arquivo `.nojekyll` precisa estar no repo). Se o `config.js` ainda estiver vazio, o site abre em "modo demonstração" — isso é esperado.
7. **Resumo final**: me diga a URL do repositório, a URL do site e o que ainda falta (configurar o Supabase seguindo o README, se eu ainda não fiz).

Regras: não force push, não apague arquivos, não mude o código do app e me pergunte antes de qualquer coisa destrutiva.
