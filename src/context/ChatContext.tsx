import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';

type Profile = Tables<'profiles'>;
type Conversation = Tables<'conversations'>;
type ConversationMember = Tables<'conversation_members'>;
type Message = Tables<'messages'>;

interface ConversationWithDetails extends Conversation {
  members: (ConversationMember & { profile?: Profile })[];
  lastMessage?: Message & { sender?: Profile };
  unreadCount: number;
}

interface ChatContextType {
  conversations: ConversationWithDetails[];
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  messages: Message[];
  sendMessage: (text: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showInfoPanel: boolean;
  toggleInfoPanel: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  activeConversation: ConversationWithDetails | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  profiles: Record<string, Profile>;
  createPrivateChat: (userId: string) => Promise<string | null>;
  createGroup: (name: string, memberIds: string[]) => Promise<string | null>;
  allProfiles: Profile[];
  deleteConversation: (convId: string) => Promise<void>;
  leaveGroup: (convId: string) => Promise<void>;
  ensureSavedMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!user) return;
    const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('*');
      if (data) {
        const map: Record<string, Profile> = {};
        data.forEach(p => { map[p.id] = p; });
        setProfiles(map);
        setAllProfiles(data);
      }
    };
    fetchProfiles();
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConversations(true);
    const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
    if (!memberships || memberships.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }
    const convIds = memberships.map(m => m.conversation_id);
    const { data: convs } = await supabase.from('conversations').select('*').in('id', convIds).order('updated_at', { ascending: false });
    if (!convs) { setLoadingConversations(false); return; }
    const { data: allMembers } = await supabase.from('conversation_members').select('*').in('conversation_id', convIds);

    const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
      convs.map(async (conv) => {
        const members = (allMembers || []).filter(m => m.conversation_id === conv.id).map(m => ({ ...m, profile: profiles[m.user_id] }));
        const { data: lastMsgData } = await supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1);
        const lastMessage = lastMsgData?.[0] ? { ...lastMsgData[0], sender: profiles[lastMsgData[0].sender_id] } : undefined;
        return { ...conv, members, lastMessage, unreadCount: 0 };
      })
    );
    setConversations(conversationsWithDetails);
    setLoadingConversations(false);
  }, [user, profiles]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!activeConversationId || !user) { setMessages([]); return; }
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', activeConversationId).order('created_at', { ascending: true }).limit(100);
      setMessages(data || []);
      setLoadingMessages(false);
    };
    fetchMessages();
  }, [activeConversationId, user]);

  useEffect(() => {
    if (!activeConversationId) return;
    const channel = supabase.channel(`messages:${activeConversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new as Message]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as any;
            if (old?.id) setMessages(prev => prev.filter(m => m.id !== old.id));
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversationId]);

  // Realtime profile updates (online/offline status)
  useEffect(() => {
    const channel = supabase.channel('profiles-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload: RealtimePostgresChangesPayload<Profile>) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Profile;
            setProfiles(prev => ({ ...prev, [updated.id]: updated }));
            setAllProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling fallback for online status (every 15s)
  useEffect(() => {
    if (!user) return;
    const pollProfiles = async () => {
      const { data } = await supabase.from('profiles').select('*');
      if (data) {
        const map: Record<string, Profile> = {};
        data.forEach(p => { map[p.id] = p; });
        setProfiles(map);
        setAllProfiles(data);
      }
    };
    const interval = setInterval(pollProfiles, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!activeConversationId || !user || !text.trim()) return;
    await supabase.from('messages').insert({
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: text.trim(),
      message_type: 'text',
    });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversationId);
  }, [activeConversationId, user]);

  const deleteConversation = useCallback(async (convId: string) => {
    if (!user) return;
    try {
      await supabase.from('messages').delete().eq('conversation_id', convId);
      await supabase.from('conversation_members').delete().eq('conversation_id', convId);
      const { error } = await supabase.from('conversations').delete().eq('id', convId);
      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) setActiveConversationId(null);
      toast.success('Đã xoá cuộc trò chuyện');
    } catch (err: any) {
      toast.error('Lỗi xoá: ' + (err.message || 'Unknown'));
    }
  }, [user, activeConversationId]);

  const leaveGroup = useCallback(async (convId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('conversation_members').delete().eq('conversation_id', convId).eq('user_id', user.id);
      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) setActiveConversationId(null);
      toast.success('Đã rời nhóm');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  }, [user, activeConversationId]);

  const ensureSavedMessages = useCallback(async () => {
    if (!user) return;
    // Check if Saved Messages exists
    const existing = conversations.find(c => c.name === 'Saved Messages' && c.created_by === user.id);
    if (existing) {
      setActiveConversationId(existing.id);
      return;
    }
    // Create it
    const { data: conv, error } = await supabase.from('conversations').insert({
      type: 'private' as const,
      name: 'Saved Messages',
      created_by: user.id,
      pinned: true,
    }).select().single();
    if (error || !conv) { toast.error('Lỗi tạo Saved Messages'); return; }
    await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id, role: 'owner' as const });
    await fetchConversations();
    setActiveConversationId(conv.id);
  }, [user, conversations, fetchConversations]);

  const createPrivateChat = useCallback(async (userId: string): Promise<string | null> => {
    if (!user) return null;
    const { data: existingMembers } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
    if (existingMembers) {
      for (const m of existingMembers) {
        const { data: otherMember } = await supabase.from('conversation_members').select('conversation_id').eq('conversation_id', m.conversation_id).eq('user_id', userId);
        if (otherMember && otherMember.length > 0) {
          const { data: conv } = await supabase.from('conversations').select('type').eq('id', m.conversation_id).eq('type', 'private').single();
          if (conv) return m.conversation_id;
        }
      }
    }
    const { data: conv, error } = await supabase.from('conversations').insert({ type: 'private', created_by: user.id }).select().single();
    if (error || !conv) return null;
    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: user.id, role: 'member' as const },
      { conversation_id: conv.id, user_id: userId, role: 'member' as const },
    ]);
    await fetchConversations();
    return conv.id;
  }, [user, fetchConversations]);

  const createGroup = useCallback(async (name: string, memberIds: string[]): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data: conv, error } = await supabase.from('conversations').insert({ type: 'group', name, created_by: user.id }).select().single();
      if (error || !conv) { console.error('Create group conv error:', error); toast.error('Lỗi tạo nhóm'); return null; }
      
      // Insert owner FIRST (RLS requires owner to exist before adding other members)
      const { error: ownerErr } = await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id, role: 'owner' as const });
      if (ownerErr) { console.error('Add owner error:', ownerErr); toast.error('Lỗi thêm chủ nhóm'); return null; }
      
      // Then insert other members
      if (memberIds.length > 0) {
        const otherMembers = memberIds.map(id => ({ conversation_id: conv.id, user_id: id, role: 'member' as const }));
        const { error: membersErr } = await supabase.from('conversation_members').insert(otherMembers);
        if (membersErr) { console.error('Add members error:', membersErr); toast.error('Lỗi thêm thành viên, nhưng nhóm đã được tạo'); }
      }
      
      await fetchConversations();
      return conv.id;
    } catch (err: any) {
      console.error('Create group error:', err);
      toast.error('Lỗi tạo nhóm: ' + (err.message || 'Unknown'));
      return null;
    }
  }, [user, fetchConversations]);

  const toggleInfoPanel = useCallback(() => setShowInfoPanel(p => !p), []);
  const toggleDarkMode = useCallback(() => setDarkMode(p => !p), []);
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  return (
    <ChatContext.Provider value={{
      conversations, activeConversationId, setActiveConversation: setActiveConversationId,
      messages, sendMessage, searchQuery, setSearchQuery,
      showInfoPanel, toggleInfoPanel, darkMode, toggleDarkMode,
      activeConversation, loadingConversations, loadingMessages,
      profiles, createPrivateChat, createGroup, allProfiles,
      deleteConversation, leaveGroup, ensureSavedMessages,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
