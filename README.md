# Cantina Essência — Sistema de Pedidos

Sistema de pedidos para a cantina do Ministério Essência (ministério de jovens), com cardápio público, carrinho, checkout com Stripe, e painel administrativo.

## Stack

- **Frontend**: HTML/CSS/JS vanilla (ES Modules), static hosting
- **Backend**: Supabase (Postgres + RLS + Auth + Edge Functions)
- **Pagamento**: Stripe Checkout (Session mode)
- **Deploy**: Vercel (static) + Supabase (managed)

## Estrutura

```
public/               ← Frontend estático (deploy Vercel)
  index.html          ← Cardápio público
  checkout.html       ← Checkout / criar pedido
  success.html        ← Confirmação pós-pagamento
  cancel.html         ← Pagamento cancelado
  admin/
    login.html        ← Login admin (Supabase Auth)
    products.html     ← CRUD de produtos
    orders.html       ← Gestão de pedidos
  assets/
    styles.css        ← Estilos
    config.js         ← Configurações (NÃO commitar)
    config.example.js ← Template de config
    supabaseClient.js ← Cliente Supabase
    app.js            ← Utilitários compartilhados
    cart.js            ← Carrinho (localStorage)
    publicProducts.js  ← Listagem pública
    checkout.js        ← Fluxo de checkout
    stripePay.js       ← Verificação de sessão Stripe
    adminAuth.js       ← Auth admin
    adminProducts.js   ← CRUD produtos admin
    adminOrders.js     ← Gestão pedidos admin
supabase/
  supabase.sql        ← Schema completo do banco
  functions/
    create-checkout-session/  ← Cria sessão Stripe
    stripe-webhook/           ← Recebe webhook do Stripe
```

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute `supabase/supabase.sql` no SQL Editor para criar o schema completo.

### 2. Admin e Provisionamento

Crie e garanta o acesso do administrador sem armazenar credenciais no código:
1. Copie o `.env.example` para `.env` na raiz do projeto.
2. Preencha o `.env` com a sua `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e defina uma `SUPABASE_ADMIN_INITIAL_PASSWORD` forte. 
   *(Nunca commite o arquivo `.env` nem a service role key).*
3. Instale as dependências para o script Node.js:
   ```bash
   npm init -y
   npm install @supabase/supabase-js dotenv
   ```

**Como promover a ADMIN:**
- **Opção A (Via Script):** Rode o script de provisionamento:
   ```bash
   node scripts/provision-admin.js
   ```
   *Isso criará o usuário `admin@admin.com` no seu Supabase Auth, e definirá a role dele como `ADMIN` na tabela `profiles`.*

- **Opção B (Via SQL no Supabase):**
   1. Crie o usuário normalmente via Supabase Auth ou pela página.
   2. No SQL Editor do Supabase, rode:
   ```sql
   UPDATE profiles SET role = 'ADMIN' WHERE id = '<auth-user-id>';
   ```

**Como revogar acesso de ADMIN:**
- Vá no SQL Editor do Supabase e rode:
   ```sql
   UPDATE profiles SET role = 'USER' WHERE id = '<auth-user-id>';
   ```

Para alterar a senha do admin futuramente, utilize a funcionalidade padrão de "Reset Password" (esqueci minha senha) enviando o email de recovery pela interface do seu Supabase ou implementando o fluxo no frontend.

### 3. Config Frontend

Copie `public/assets/config.example.js` para `public/assets/config.js` e preencha:

```js
export const SUPABASE_URL = 'https://seu-projeto.supabase.co';
export const SUPABASE_ANON_KEY = 'sua-anon-key';
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_...';
export const SITE_URL = 'https://seu-site.vercel.app';
```

### 4. Stripe

1. Crie uma conta em [stripe.com](https://stripe.com) (modo test)
2. Pegue as chaves em Developers > API Keys:
   - `STRIPE_PUBLISHABLE_KEY` → frontend config.js
   - `STRIPE_SECRET_KEY` → env da Edge Function no Supabase
3. Configure o webhook:
   - URL: `https://seu-projeto.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Copie o `STRIPE_WEBHOOK_SECRET` → env da Edge Function

### 5. Edge Functions — Environment Variables

No dashboard do Supabase, em **Edge Functions > Secrets**, configure:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://seu-site.vercel.app
```

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente)

### 6. Deploy Vercel

1. Faça push do repo para GitHub
2. Importe no Vercel como static site
3. Output directory: `public`
4. Deploy!

## Fluxo de Pedido

1. Cliente navega no cardápio (`index.html`)
2. Adiciona itens ao carrinho (localStorage)
3. Vai para checkout (`checkout.html`)
4. Preenche nome e observações
5. Confirma → cria `order` + `order_items` no Supabase
6. Clica "Pagar com Stripe" → Edge Function cria Checkout Session
7. Redireciona para Stripe Checkout
8. Após pagamento, Stripe envia webhook → Edge Function confirma pedido
9. Cliente vê confirmação (`success.html`)

## Admin

- Login via Supabase Auth (email/senha)
- Verificação de role `ADMIN` na tabela `profiles`
- CRUD de produtos com busca/filtros
- Gestão de pedidos com ações rápidas (marcar pago, entregue, cancelar)

## Número do Pedido

- Sequência `order_number_seq` no Postgres
- Formato: 5 dígitos com zero à esquerda (00001, 00002...)
- Se ultrapassar 99999, aceita 6+ dígitos automaticamente (lpad mínimo 5)
- Geração atômica via `DEFAULT` da coluna

## RLS (Row Level Security)

- `products`: anon pode ver ativos; admin pode tudo
- `orders`: anon pode criar; admin pode ver/atualizar
- `order_items`: anon pode criar e ver; admin pode tudo
- `payments`: apenas admin pode ver
- `profiles`: usuário vê próprio; admin vê todos
- Edge Functions usam `SERVICE_ROLE_KEY` (bypass RLS)
