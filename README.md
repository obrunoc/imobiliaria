# VC Imóveis

Site da VC Imóveis — Realizando sonhos. Brazópolis, MG.

Site público para comprar e alugar imóveis e um painel da equipe (`admin.html`) com login,
cadastro de imóveis, atendimento de clientes, locações ativas e gerador de documentos.

No ar: <https://vc-imoveis.vercel.app> (cada push no `main` publica automaticamente).

## Como rodar localmente

Sirva a pasta na raiz de um servidor estático, por exemplo `python -m http.server 8000`,
e abra <http://localhost:8000>. Localmente a página de cada imóvel é `imovel.html?cod=12`
(na Vercel vira `/imovel/12`).

Sem configuração, roda em **modo demonstração**: tudo fica salvo no navegador.
Logins: `demo@vcimoveis.com.br` (dono) e `corretor@vcimoveis.com.br` (corretor), senha `demo123`.
Para colocar no ar com banco de dados e login reais, siga o [CONFIGURAR.md](CONFIGURAR.md).

## Estrutura

- `index.html`, `js/app.js`: página inicial (busca, filtros, destaques, me avise, quem somos, anunciar)
- `imovel.html`, `js/imovel.js`: página própria de cada imóvel
- `privacidade.html`: política de privacidade
- `js/site.js`: partes comuns do site (ficha do imóvel, formulários com consentimento, simulador)
- `admin.html`, `js/admin*.js`, `css/admin.css`: painel da equipe
- `js/contracts.js`, `js/docs.js`: documentos (gerados no navegador, nada é salvo)
- `js/store.js`: camada de dados (Supabase ou modo demonstração)
- `js/config.js`: chaves públicas do Supabase
- `js/data.js`: listas, dados padrão do site e imóveis de exemplo da demonstração
- `api/`: funções da Vercel (prévia do link no WhatsApp, sitemap, integração com portais)
- `supabase/setup.sql`: tabelas e regras de acesso do banco
- `img/`: ícones e imagem de prévia
