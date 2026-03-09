-- Update RLS policy to allow users to read their own roles (including admin check)
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;

CREATE POLICY "user_roles_select" ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);