-- Allow conversation creators/admins to delete conversations
CREATE POLICY "Creators can delete conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

-- Allow conversation members to update message status (for read receipts)
-- Already have update policy for senders, need one for recipients to mark as read
DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;
CREATE POLICY "Members can update messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid() 
  OR is_conversation_member(auth.uid(), conversation_id)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);