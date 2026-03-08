
-- Drop ALL existing RESTRICTIVE policies on conversations
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins and creators can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Creators can delete conversations" ON public.conversations;

-- Drop ALL existing RESTRICTIVE policies on conversation_members
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join/add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can leave or admins remove members" ON public.conversation_members;

-- Drop ALL existing RESTRICTIVE policies on messages
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Members can update messages" ON public.messages;
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;

-- Drop ALL existing RESTRICTIVE policies on profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- Drop ALL existing RESTRICTIVE policies on reactions
DROP POLICY IF EXISTS "Members can view reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.reactions;

-- Drop ALL existing RESTRICTIVE policies on user_roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

-- ============ RECREATE AS PERMISSIVE ============

-- conversations
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_member(auth.uid(), id) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "conversations_delete" ON public.conversations FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- conversation_members
CREATE POLICY "cm_select" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_conversation_member(auth.uid(), conversation_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "cm_insert" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.conversation_members cm WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid() AND cm.role IN ('owner'::member_role, 'admin'::member_role))
);
CREATE POLICY "cm_delete" ON public.conversation_members FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

-- messages
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_member(auth.uid(), conversation_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR public.is_conversation_member(auth.uid(), conversation_id) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "messages_delete" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- reactions
CREATE POLICY "reactions_select" ON public.reactions FOR SELECT TO authenticated USING (
  message_id IN (SELECT m.id FROM public.messages m JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id WHERE cm.user_id = auth.uid())
);
CREATE POLICY "reactions_insert" ON public.reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete" ON public.reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_roles
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "user_roles_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::app_role));
