
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- conversations table
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins and creators can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Creators can delete conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins and creators can update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Creators can delete conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

-- conversation_members table
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join/add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave or admins remove members" ON public.conversation_members;

CREATE POLICY "Members can view conversation members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can join/add members" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid()) 
    OR has_role(auth.uid(), 'super_admin'::app_role) 
    OR (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_members.conversation_id AND c.created_by = auth.uid()))
    OR (EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid() AND cm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])))
  );

CREATE POLICY "Users can leave or admins remove members" ON public.conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- messages table
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Members can update messages" ON public.messages;
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;

CREATE POLICY "Members can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Members can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Members can update messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR is_conversation_member(auth.uid(), conversation_id) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Senders can delete own messages" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

-- profiles table
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- reactions table
DROP POLICY IF EXISTS "Members can view reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.reactions;

CREATE POLICY "Members can view reactions" ON public.reactions
  FOR SELECT TO authenticated
  USING (message_id IN (SELECT m.id FROM messages m JOIN conversation_members cm ON cm.conversation_id = m.conversation_id WHERE cm.user_id = auth.uid()));

CREATE POLICY "Users can add reactions" ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reactions" ON public.reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- user_roles table
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));
