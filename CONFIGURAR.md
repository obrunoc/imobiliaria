# Colocar o site da VC Imóveis no ar de verdade

Hoje o site está em **modo demonstração**: tudo funciona, mas o que é cadastrado no painel fica
salvo só no navegador de quem cadastrou. Para a equipe inteira usar e os clientes verem os mesmos
imóveis, o site precisa de um banco de dados online. Usamos o **Supabase** (plano gratuito:
500 MB de banco e 1 GB para fotos e vídeos, o que dá para centenas de imóveis).

Leva uns 20 minutos e só precisa ser feito uma vez.

## 1. Criar o projeto no Supabase

1. Entre em <https://supabase.com> e crie uma conta (pode usar o Google).
2. Clique em **New project**.
   - Nome: `vc-imoveis`
   - Senha do banco: crie uma senha forte e guarde (não vai para o site).
   - Região: **South America (São Paulo)**.
3. Espere o projeto terminar de criar (1 a 2 minutos).

## 2. Criar as tabelas, as permissões e a pasta de fotos

1. No menu da esquerda, abra **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/setup.sql` deste projeto, copie tudo e cole lá.
3. **Antes de rodar**, troque `dono@vcimoveis.com.br` pelos e-mails reais da equipe:
   ```sql
   insert into public.staff (email, role) values
     ('dono@gmail.com', 'admin'),
     ('corretor1@gmail.com', 'corretor')
   on conflict (email) do update set role = excluded.role;
   ```
   - **admin** (dono): pode tudo, inclusive excluir imóveis e editar os dados do site.
   - **corretor**: cadastra e edita imóveis, atende clientes e gera documentos.
4. Clique em **Run**. Deve aparecer "Success".

## 3. Criar o login de cada pessoa da equipe

1. Vá em **Authentication** → **Sign In / Providers** e **desligue** a opção
   *Allow new users to sign up*. Assim ninguém de fora consegue criar conta.
2. Vá em **Authentication** → **Users** → **Add user** → **Create new user**.
   - Coloque o e-mail e uma senha. Marque **Auto Confirm User**.
3. Repita para cada pessoa.

> Só entra no painel quem tem login **e** está na lista `staff` do passo 2.
> Para liberar alguém depois: crie o usuário e adicione o e-mail em **Table Editor → staff**.
> Para tirar o acesso: apague o usuário em **Authentication → Users** e a linha em `staff`.

## 4. Ligar o site ao Supabase

1. Vá em **Project Settings** → **API**.
2. Copie a **Project URL** e a chave **anon public**.
3. Abra `js/config.js` e cole:
   ```js
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```
   A chave *anon* pode ficar no site: ela só permite o que as regras do passo 2 deixam
   (visitante só vê imóveis publicados e só consegue **enviar** pedidos, nunca ler).
   **Nunca** coloque a chave *service_role* no site.
4. Faça o commit e o push. A Vercel publica sozinha em alguns segundos.
5. Entre no painel como dono e preencha a aba **Site** (WhatsApp, telefone, endereço, CRECI,
   Instagram, Quem somos, equipe e depoimentos).

## 5. Domínio próprio (ex.: vcimoveis.com.br)

1. Registre o domínio em <https://registro.br> (CPF ou CNPJ da imobiliária, cerca de R$ 40/ano).
2. Na Vercel: projeto **vc-imoveis** → **Settings → Domains** → adicione o domínio e siga as
   instruções (no Registro.br, troque os servidores DNS pelos que a Vercel indicar).
3. Depois que o domínio funcionar, troque `vc-imoveis.vercel.app` pelo domínio novo em
   `robots.txt` e na imagem de prévia (`og:image`) do `index.html`.

## 6. Aparecer no Google

1. Entre em <https://search.google.com/search-console> e adicione o site.
2. Envie o mapa do site: `https://SEU-SITE/sitemap.xml` (gerado automaticamente com todos os
   imóveis publicados).
3. Crie ou atualize o **Perfil da Empresa no Google** (Google Meu Negócio) com o link do site.
   O link das avaliações vai na aba **Site** do painel.

## 7. Portais (ZAP Imóveis, Viva Real, OLX)

Os portais cobram um plano para anunciantes. Ao contratar, informe ao suporte o endereço de
integração que aparece no painel, aba **Site** (ex.: `https://SEU-SITE/portais/vrsync.xml`).
Os imóveis **disponíveis** são enviados automaticamente, sem cadastrar duas vezes.
Peça ao suporte para conferir o arquivo na ativação.

## Como a equipe usa o painel

- **Imóveis**: cadastre fotos/vídeos, valores e características. A estrela coloca o imóvel nos
  *Destaques da semana*. Baixou o preço? O site mostra o selo sozinho. Cada linha mostra quantas
  vezes o anúncio foi visto, e tem botões para copiar o link, gerar a arte do Instagram e o contrato.
- **Situação**: *Disponível* e *Reservado* aparecem no site; *Alugado*, *Vendido* e *Oculto* não.
- **Clientes**: pedidos de visita, "me avise quando aparecer" e proprietários que querem anunciar.
  Atenda pelo botão do WhatsApp (a mensagem já vem pronta), mude a situação e anote o que combinou.
  Quando cadastrar um imóvel que combina com um "me avise", o painel avisa.
- **Locações**: registre as locações ativas para ser avisado do reajuste anual e do fim do contrato.
- **Documentos**: contrato de locação, recibo, entrega de chaves, autorização de venda e vistoria
  com fotos. Nada do que é digitado ali é salvo.

## Privacidade (LGPD)

- Os formulários do site pedem o aceite da Política de Privacidade (`privacidade.html`).
  Revise o texto com o advogado e ajuste se precisar.
- Apague os dados do cliente quando ele pedir (lixeira no card) e use o botão
  **Apagar pedidos com mais de 12 meses** periodicamente.
- Não registre CPF, RG ou dados bancários em Locações nem nas anotações.
