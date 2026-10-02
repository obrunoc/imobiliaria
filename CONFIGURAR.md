# Colocar o painel da VC Imóveis no ar

Hoje o site está em **modo demonstração**: o painel funciona, mas o que é cadastrado fica salvo
só no navegador de quem cadastrou. Para a equipe inteira cadastrar imóveis e os clientes verem,
o site precisa de um banco de dados online. Usamos o **Supabase** (plano gratuito: 500 MB de
banco e 1 GB para fotos e vídeos, o que dá para centenas de imóveis).

Leva uns 20 minutos e só precisa ser feito uma vez.

## 1. Criar o projeto no Supabase

1. Entre em <https://supabase.com> e crie uma conta (pode usar o Google).
2. Clique em **New project**.
   - Nome: `vc-imoveis`
   - Senha do banco: crie uma senha forte e guarde (não vai para o site).
   - Região: **South America (São Paulo)**.
3. Espere o projeto terminar de criar (1 a 2 minutos).

## 2. Criar as tabelas e a pasta de fotos

1. No menu da esquerda, abra **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/setup.sql` deste projeto, copie tudo e cole lá.
3. **Antes de rodar**, troque `dono@vcimoveis.com.br` pelos e-mails reais da equipe, um por linha:
   ```sql
   insert into public.staff (email) values
     ('dono@gmail.com'),
     ('corretor1@gmail.com')
   on conflict do nothing;
   ```
4. Clique em **Run**. Deve aparecer "Success".

## 3. Criar o login de cada pessoa da equipe

1. Vá em **Authentication** → **Sign In / Providers** e **desligue** a opção
   *Allow new users to sign up*. Assim ninguém de fora consegue criar conta.
2. Vá em **Authentication** → **Users** → **Add user** → **Create new user**.
   - Coloque o e-mail e uma senha.
   - Marque **Auto Confirm User**.
3. Repita para cada funcionário.

> Só entra no painel quem tem login **e** está na lista `staff` do passo 2.
> Para liberar alguém depois: crie o usuário (passo 3) e adicione o e-mail em
> **Table Editor** → `staff` → **Insert row**.
> Para tirar o acesso: apague o usuário em **Authentication → Users**.

## 4. Ligar o site ao Supabase

1. Vá em **Project Settings** → **API**.
2. Copie a **Project URL** e a chave **anon public**.
3. Abra `js/config.js` e cole:
   ```js
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```
   A chave *anon* pode ficar no site: ela só permite o que as regras do passo 2 deixam.
   **Nunca** coloque a chave *service_role* no site.
4. Aproveite e troque o número em `whatsapp:` pelo WhatsApp real da imobiliária.

## 5. Publicar o site

O jeito mais simples é o **Netlify**:

1. Entre em <https://app.netlify.com/drop>.
2. Arraste a pasta inteira do projeto para a página.
3. Pronto: o site ganha um endereço. Depois dá para ligar um domínio próprio
   (ex.: `vcimoveis.com.br`) em **Domain settings**.

O painel fica em `seusite/admin.html`, e também tem o link **Área da equipe** no rodapé do site.

## Como a equipe usa o painel

- **Novo imóvel**: fotos/vídeos, venda ou aluguel, bairro, preço e características → **Salvar**.
  O imóvel aparece no site na hora.
- **Situação** (direto na lista):
  - *Disponível*: aparece no site.
  - *Reservado*: aparece no site com o selo "Reservado".
  - *Alugado* / *Vendido*: sai do site e fica guardado no painel.
  - *Oculto*: fora do site (bom para rascunho).
- **Excluir**: apaga o imóvel e as fotos de vez.
- Fotos são reduzidas automaticamente antes de enviar, então pode mandar direto do celular.
  Vídeos têm limite de 50 MB por arquivo.
