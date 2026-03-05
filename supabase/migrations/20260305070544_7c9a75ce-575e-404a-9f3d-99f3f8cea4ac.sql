
-- Create security definer function to check conversation membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

-- Drop all existing policies on conversation_members
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join/add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.conversation_members;

-- Recreate policies using security definer function
CREATE POLICY "Members can view conversation members" ON public.conversation_members
FOR SELECT TO authenticated
USING (
  is_conversation_member(auth.uid(), conversation_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Users can join/add members" ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can remove members" ON public.conversation_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Fix conversations SELECT policy to avoid recursion through conversation_members
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
  is_conversation_member(auth.uid(), id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Fix messages policies to avoid recursion
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages" ON public.messages
FOR SELECT TO authenticated
USING (
  is_conversation_member(auth.uid(), conversation_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_conversation_member(auth.uid(), conversation_id)
);

-- Fix conversations INSERT - allow any authenticated user to create
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);
