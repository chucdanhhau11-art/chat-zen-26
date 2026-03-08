CREATE POLICY "cm_update" ON public.conversation_members FOR UPDATE USING (
  (user_id = auth.uid()) 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM conversation_members cm 
    WHERE cm.conversation_id = conversation_members.conversation_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'owner'::member_role
  ))
);