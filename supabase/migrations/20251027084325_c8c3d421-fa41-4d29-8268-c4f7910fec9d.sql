-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('manager', 'kiosk');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  kiosk_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Factory inventory table
CREATE TABLE public.factory_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Stock',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.factory_inventory ENABLE ROW LEVEL SECURITY;

-- Factory inventory policies
CREATE POLICY "Authenticated users can view factory inventory"
  ON public.factory_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only managers can modify factory inventory"
  ON public.factory_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Kiosk inventory table
CREATE TABLE public.kiosk_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kiosk_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Stock',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.kiosk_inventory ENABLE ROW LEVEL SECURITY;

-- Kiosk inventory policies
CREATE POLICY "Kiosks can view their own inventory"
  ON public.kiosk_inventory FOR SELECT
  USING (kiosk_id = auth.uid());

CREATE POLICY "Kiosks can update their own inventory"
  ON public.kiosk_inventory FOR UPDATE
  USING (kiosk_id = auth.uid());

CREATE POLICY "Managers can view all kiosk inventory"
  ON public.kiosk_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can modify all kiosk inventory"
  ON public.kiosk_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kiosk_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  payment_type TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Kiosks can view their own orders"
  ON public.orders FOR SELECT
  USING (kiosk_id = auth.uid());

CREATE POLICY "Kiosks can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (kiosk_id = auth.uid());

CREATE POLICY "Managers can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kiosk_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'Preparing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Purchase orders policies
CREATE POLICY "Kiosks can view their own purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (kiosk_id = auth.uid());

CREATE POLICY "Kiosks can create their own purchase orders"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (kiosk_id = auth.uid());

CREATE POLICY "Managers can view all purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update purchase orders"
  ON public.purchase_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  kiosk_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revenue NUMERIC(10, 2) NOT NULL DEFAULT 0,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reports policies
CREATE POLICY "Kiosks can view their own reports"
  ON public.reports FOR SELECT
  USING (kiosk_id = auth.uid());

CREATE POLICY "Kiosks can manage their own reports"
  ON public.reports FOR ALL
  USING (kiosk_id = auth.uid());

CREATE POLICY "Managers can view all reports"
  ON public.reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Clock logs table for attendance with photos
CREATE TABLE public.clock_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kiosk_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.clock_logs ENABLE ROW LEVEL SECURITY;

-- Clock logs policies
CREATE POLICY "Kiosks can view their own clock logs"
  ON public.clock_logs FOR SELECT
  USING (kiosk_id = auth.uid());

CREATE POLICY "Kiosks can create their own clock logs"
  ON public.clock_logs FOR INSERT
  WITH CHECK (kiosk_id = auth.uid());

CREATE POLICY "Managers can view all clock logs"
  ON public.clock_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_factory_inventory_updated_at
  BEFORE UPDATE ON public.factory_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kiosk_inventory_updated_at
  BEFORE UPDATE ON public.kiosk_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.factory_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosk_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clock_logs;

-- Create storage bucket for clock-in photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clockin-photos', 'clockin-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for clock-in photos
CREATE POLICY "Authenticated users can upload clock-in photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'clockin-photos');

CREATE POLICY "Public access to clock-in photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'clockin-photos');