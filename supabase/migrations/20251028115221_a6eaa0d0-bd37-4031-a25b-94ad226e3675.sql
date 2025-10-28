-- Allow managers to delete orders
CREATE POLICY "Managers can delete orders"
ON public.orders
FOR DELETE
USING (get_user_role(auth.uid()) = 'manager'::user_role);

-- Allow managers to delete clock logs
CREATE POLICY "Managers can delete clock logs"
ON public.clock_logs
FOR DELETE
USING (get_user_role(auth.uid()) = 'manager'::user_role);

-- Allow managers to delete reports
CREATE POLICY "Managers can delete reports"
ON public.reports
FOR DELETE
USING (get_user_role(auth.uid()) = 'manager'::user_role);