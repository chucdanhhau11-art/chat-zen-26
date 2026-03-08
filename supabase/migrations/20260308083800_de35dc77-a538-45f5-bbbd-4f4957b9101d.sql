-- Drop old INSERT policy and create a better one that checks conversation creator
DROP POLICY IF EXISTS "Users can join/add members" ON public.conversation_members;

CREATE POLICY "Users can join/add members"
ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])
  ))
);