# VC Imóveis

Site da VC Imóveis — Realizando sonhos. Brazópolis, MG.

Site público para comprar e alugar imóveis, mais um painel (`admin.html`) onde a equipe entra com
login e cadastra, edita, muda a situação e exclui imóveis, com fotos e vídeos.

## Como rodar

Sirva a pasta com qualquer servidor estático (ex.: `npx serve .` ou `python -m http.server`) e abra
`index.html`. O painel fica em `admin.html` (link "Área da equipe" no rodapé).

Sem configuração, roda em **modo demonstração**: tudo fica salvo no navegador e o login é
`demo@vcimoveis.com.br` / `demo123`. Para colocar no ar com banco de dados e login reais,
siga o [CONFIGURAR.md](CONFIGURAR.md).

## Estrutura

- `index.html`, `js/app.js`: site público (busca, filtros, favoritos, detalhes, agendamento de visita)
- `admin.html`, `js/admin.js`, `css/admin.css`: painel da equipe
- `js/store.js`: camada de dados (Supabase ou modo demonstração)
- `js/config.js`: chaves do Supabase e número do WhatsApp
- `js/data.js`: listas (tipos, bairros sugeridos, diferenciais) e imóveis de exemplo da demonstração
- `css/styles.css`: visual da marca (grafite, dourado e branco)
- `supabase/setup.sql`: tabelas, permissões e pasta de fotos no Supabase
