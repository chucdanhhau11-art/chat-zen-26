
-- Update app_role enum: remove super_admin, keep admin and user
-- First update existing super_admin roles to admin
UPDATE public.user_roles SET role = 'admin' WHERE role = 'super_admin';

-- Update has_role function to work with new role set
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Add a leave_group function: remove member but keep messages
-- We need a policy for conversation_members DELETE that allows users to leave
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;
CREATE POLICY "Users can leave or admins remove members"
ON public.conversation_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);
