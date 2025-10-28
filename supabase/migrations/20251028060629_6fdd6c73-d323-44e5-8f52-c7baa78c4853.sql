-- Fix factory_inventory policies
DROP POLICY IF EXISTS "Only managers can modify factory inventory" ON public.factory_inventory;
CREATE POLICY "Only managers can modify factory inventory"
  ON public.factory_inventory FOR ALL
  USING (public.get_user_role(auth.uid()) = 'manager');

-- Fix kiosk_inventory policies
DROP POLICY IF EXISTS "Managers can view all kiosk inventory" ON public.kiosk_inventory;
CREATE POLICY "Managers can view all kiosk inventory"
  ON public.kiosk_inventory FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'manager');

DROP POLICY IF EXISTS "Managers can modify all kiosk inventory" ON public.kiosk_inventory;
CREATE POLICY "Managers can modify all kiosk inventory"
  ON public.kiosk_inventory FOR ALL
  USING (public.get_user_role(auth.uid()) = 'manager');

-- Fix orders policies
DROP POLICY IF EXISTS "Managers can view all orders" ON public.orders;
CREATE POLICY "Managers can view all orders"
  ON public.orders FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'manager');

-- Fix purchase_orders policies
DROP POLICY IF EXISTS "Managers can view all purchase orders" ON public.purchase_orders;
CREATE POLICY "Managers can view all purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'manager');

DROP POLICY IF EXISTS "Managers can update purchase orders" ON public.purchase_orders;
CREATE POLICY "Managers can update purchase orders"
  ON public.purchase_orders FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'manager');

-- Fix reports policies
DROP POLICY IF EXISTS "Managers can view all reports" ON public.reports;
CREATE POLICY "Managers can view all reports"
  ON public.reports FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'manager');

-- Fix clock_logs policies
DROP POLICY IF EXISTS "Managers can view all clock logs" ON public.clock_logs;
CREATE POLICY "Managers can view all clock logs"
  ON public.clock_logs FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'manager');