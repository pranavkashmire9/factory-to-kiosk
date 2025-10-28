-- Drop the problematic policy
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;

-- Create a security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- Recreate the policy using the function
CREATE POLICY "Managers can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'manager');