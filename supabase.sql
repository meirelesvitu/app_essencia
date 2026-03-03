-- ============================================================
-- CANTINA ESSÊNCIA — Supabase SQL Schema
-- ============================================================

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Sequence for order numbers (5-digit, accepts 6+ if overflow)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1 INCREMENT 1 MINVALUE 1 NO MAXVALUE NO CYCLE;

-- 2) Helper: is_admin()
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- 3) Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4) Tables

-- profiles (links auth.users to role)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
  created_at timestamptz DEFAULT now()
);

-- trigger to insert profile for new auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'USER');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  image_url text,
  active boolean NOT NULL DEFAULT true,
  stock integer CHECK (stock IS NULL OR stock >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT lpad(nextval('order_number_seq')::text, 5, '0'),
  customer_name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','PAID','DELIVERED','CANCELLED')),
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','CONFIRMED','CANCELLED','REFUNDED')),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- order_items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name_snapshot text NOT NULL,
  unit_price_cents_snapshot integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal_cents integer NOT NULL
);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'STRIPE',
  provider_ref text,
  status text NOT NULL CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','REFUNDED')),
  amount_cents integer NOT NULL,
  raw_event jsonb,
  created_at timestamptz DEFAULT now()
);

-- 5) Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 6) RLS Policies

-- profiles
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Admins update profiles" ON profiles FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- products
CREATE POLICY "anon_select_active_products" ON products FOR SELECT USING (active = true);
CREATE POLICY "admin_all_products" ON products FOR ALL USING (is_admin());

-- orders
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_own_order" ON orders FOR SELECT USING (stripe_checkout_session_id IS NOT NULL OR is_admin());
CREATE POLICY "admin_all_orders" ON orders FOR ALL USING (is_admin());

-- order_items
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "admin_all_order_items" ON order_items FOR ALL USING (is_admin());

-- payments
CREATE POLICY "admin_all_payments" ON payments FOR ALL USING (is_admin());

-- 7) Seed admin profile (run after creating user in Supabase Auth, or via provisioning script)
-- INSERT INTO profiles (id, role) VALUES ('<auth-user-uuid>', 'ADMIN');

-- 8) Seed example products
INSERT INTO products (name, description, price_cents, image_url, active, stock) VALUES
  ('Coxinha', 'Coxinha de frango cremosa', 600, '🍗', true, 50),
  ('Pastel de Carne', 'Pastel frito crocante com carne moída', 700, '🥟', true, 40),
  ('Pão de Queijo', 'Quentinho, direto do forno', 400, '🧀', true, 80),
  ('Brigadeiro', 'Tradicional, feito com carinho', 300, '🍫', true, 100),
  ('Refrigerante Lata', 'Coca-Cola, Guaraná ou Fanta', 500, '🥤', true, 60),
  ('Suco Natural', 'Laranja, limão ou maracujá', 600, '🧃', true, 30),
  ('Cachorro-Quente', 'Completo com purê e batata palha', 800, '🌭', true, 35),
  ('Bolo de Cenoura', 'Com cobertura de chocolate', 500, '🍰', false, 0)
ON CONFLICT DO NOTHING;
