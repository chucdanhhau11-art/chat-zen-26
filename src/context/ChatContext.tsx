import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';

const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);
      osc.start(audioCtx.currentTime + startTime);
      osc.stop(audioCtx.currentTime + startTime + duration);
    };
    playTone(800, 0, 0.1);
    playTone(1200, 0.08, 0.12);
  } catch (e) {}
};

// Register service worker and request notification permission
let swRegistration: ServiceWorkerRegistration | null = null;

const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');
    } catch (e) {
      console.warn('SW registration failed:', e);
    }
  }
};

const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  await registerServiceWorker();
};

const showBrowserNotification = async (title: string, body: string) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  try {
    // Use SW notification for mobile compatibility (works in background)
    const reg = swRegistration || (await navigator.serviceWorker?.getRegistration());
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'chat-message-' + Date.now(),
        vibrate: [200, 100, 200],
      } as NotificationOptions);
      return;
    }
  } catch (e) {}
  
  // Fallback for desktop
  try {
    const notif = new Notification(title, { body, icon: '/favicon.ico', tag: 'chat-message' });
    setTimeout(() => notif.close(), 5000);
  } catch (e) {}
};

type Profile = Tables<'profiles'>;
type Conversation = Tables<'conversations'>;
type ConversationMember = Tables<'conversation_members'>;
type Message = Tables<'messages'>;

interface ConversationWithDetails extends Conversation {
  members: (ConversationMember & { profile?: Profile })[];
  lastMessage?: Message & { sender?: Profile };
  unreadCount: number;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  updated_at: string;
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
  leaveGroup: (convId: string, newOwnerId?: string) => Promise<void>;
  ensureSavedMessages: () => Promise<void>;
  isMobileShowingChat: boolean;
  setMobileShowingChat: (v: boolean) => void;
  clearUnread: (convId: string) => void;
  openBotFatherChat: () => Promise<void>;
  isBotFatherConversation: (convId: string | null) => boolean;
  // Friendship
  friendships: Friendship[];
  friends: Profile[];
  pendingRequests: Friendship[];
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  getFriendshipWith: (userId: string) => Friendship | null;
  addMemberToGroup: (convId: string, userId: string) => Promise<void>;
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
  const [isMobileShowingChat, setMobileShowingChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const unreadCountsRef = useRef<Record<string, number>>({});
  const profilesRef = useRef<Record<string, Profile>>({});
  const activeConversationIdRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  const [friendships, setFriendships] = useState<Friendship[]>([]);

  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { unreadCountsRef.current = unreadCounts; }, [unreadCounts]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Request browser notification permission
  useEffect(() => {
    if (user) requestNotificationPermission();
  }, [user]);

  // Fetch friendships
  const fetchFriendships = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (data) setFriendships(data as Friendship[]);
  }, [user]);

  useEffect(() => {
    if (user) fetchFriendships();
  }, [user, fetchFriendships]);

  // Realtime friendships
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('friendships-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        fetchFriendships();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchFriendships]);

  // Fetch profiles once
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

  const fetchConversations = useCallback(async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setLoadingConversations(true);

    const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
    if (!memberships || memberships.length === 0) {
      setConversations([]);
      setLoadingConversations(false);
      initialLoadDone.current = true;
      return;
    }
    const convIds = memberships.map(m => m.conversation_id);
    const { data: convs } = await supabase.from('conversations').select('*').in('id', convIds).order('updated_at', { ascending: false });
    if (!convs) { setLoadingConversations(false); initialLoadDone.current = true; return; }
    const { data: allMembers } = await supabase.from('conversation_members').select('*').in('conversation_id', convIds);

    const currentProfiles = profilesRef.current;
    const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
      convs.map(async (conv) => {
        const members = (allMembers || []).filter(m => m.conversation_id === conv.id).map(m => ({ ...m, profile: currentProfiles[m.user_id] }));
        const { data: lastMsgData } = await supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1);
        const lastMessage = lastMsgData?.[0] ? { ...lastMsgData[0], sender: currentProfiles[lastMsgData[0].sender_id] } : undefined;
        return { ...conv, members, lastMessage, unreadCount: unreadCountsRef.current[conv.id] || 0 };
      })
    );
    setConversations(conversationsWithDetails);
    setLoadingConversations(false);
    initialLoadDone.current = true;
  }, [user]);

  // Initial load + auto-create Saved Messages
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(async () => {
      await fetchConversations(true);
      // Auto-create Saved Messages if not exists
      const { data: existingConvs } = await supabase.from('conversations')
        .select('id').eq('name', 'Saved Messages').eq('created_by', user.id);
      if (!existingConvs || existingConvs.length === 0) {
        const { data: conv } = await supabase.from('conversations').insert({
          type: 'private' as const,
          name: 'Saved Messages',
          created_by: user.id,
          pinned: true,
        }).select().single();
        if (conv) {
          await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id, role: 'owner' as const });
          await fetchConversations(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [user, fetchConversations]);

  // Listen for conversation changes (new conversations, updates)
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        fetchConversations(false);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  // Global listener for new messages → unread counts + notification sound
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('global-messages-notify')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const newMsg = payload.new as Message;
          if (!newMsg || newMsg.sender_id === user.id) return;
          // Only count if not currently viewing that conversation
          if (activeConversationIdRef.current !== newMsg.conversation_id) {
            const newCount = (unreadCountsRef.current[newMsg.conversation_id] || 0) + 1;
            // Update ref immediately so fetchConversations won't race-reset it
            unreadCountsRef.current = { ...unreadCountsRef.current, [newMsg.conversation_id]: newCount };
            setUnreadCounts(prev => ({
              ...prev,
              [newMsg.conversation_id]: newCount,
            }));
            playNotificationSound();
            // Show browser notification
            const senderProfile = profilesRef.current[newMsg.sender_id];
            const senderName = senderProfile?.display_name || 'Tin nhắn mới';
            showBrowserNotification(senderName, newMsg.content || '📎 File');
            // Update conversations to reflect new unread
            setConversations(prev => prev.map(c =>
              c.id === newMsg.conversation_id
                ? { ...c, unreadCount: (c.unreadCount || 0) + 1, lastMessage: { ...newMsg, sender: profilesRef.current[newMsg.sender_id] } }
                : c
            ));
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);


  const userIdRef = useRef<string | null>(null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);

  useEffect(() => {
    if (!activeConversationId || !userIdRef.current) { setMessages([]); return; }
    const fetchMessages = async () => {
      setLoadingMessages(true);
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', activeConversationId).order('created_at', { ascending: true }).limit(100);
      setMessages(data || []);
      setLoadingMessages(false);
    };
    fetchMessages();
  }, [activeConversationId]);

  // Realtime messages
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

  // Realtime profile updates
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

  // Profile polling fallback (every 30s instead of 15s to reduce load)
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
    const interval = setInterval(pollProfiles, 30000);
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
      if (activeConversationId === convId) { setActiveConversationId(null); setMobileShowingChat(false); }
      toast.success('Đã xoá cuộc trò chuyện');
    } catch (err: any) {
      toast.error('Lỗi xoá: ' + (err.message || 'Unknown'));
    }
  }, [user, activeConversationId]);

  const leaveGroup = useCallback(async (convId: string, newOwnerId?: string) => {
    if (!user) return;
    try {
      // If transferring ownership, update the new owner's role first
      if (newOwnerId) {
        const { error: transferErr } = await supabase.from('conversation_members')
          .update({ role: 'owner' as const })
          .eq('conversation_id', convId)
          .eq('user_id', newOwnerId);
        if (transferErr) throw transferErr;
        // Also update conversations.created_by so the new owner has delete rights
        await supabase.from('conversations').update({ created_by: newOwnerId }).eq('id', convId);
      }
      const { error } = await supabase.from('conversation_members').delete().eq('conversation_id', convId).eq('user_id', user.id);
      if (error) throw error;
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) { setActiveConversationId(null); setMobileShowingChat(false); }
      toast.success('Đã rời nhóm');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  }, [user, activeConversationId]);

  const ensureSavedMessages = useCallback(async () => {
    if (!user) return;
    const existing = conversations.find(c => c.name === 'Saved Messages' && c.created_by === user.id);
    if (existing) {
      setActiveConversationId(existing.id);
      setMobileShowingChat(true);
      return;
    }
    const { data: conv, error } = await supabase.from('conversations').insert({
      type: 'private' as const,
      name: 'Saved Messages',
      created_by: user.id,
      pinned: true,
    }).select().single();
    if (error || !conv) { toast.error('Lỗi tạo Saved Messages'); return; }
    await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id, role: 'owner' as const });
    await fetchConversations(false);
    setActiveConversationId(conv.id);
    setMobileShowingChat(true);
  }, [user, conversations, fetchConversations]);

  const createPrivateChat = useCallback(async (userId: string): Promise<string | null> => {
    if (!user) return null;
    try {
      // Check existing private chat
      const { data: existingMembers } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
      if (existingMembers) {
        for (const m of existingMembers) {
          const { data: otherMember } = await supabase.from('conversation_members').select('conversation_id').eq('conversation_id', m.conversation_id).eq('user_id', userId);
          if (otherMember && otherMember.length > 0) {
            const { data: conv } = await supabase.from('conversations').select('type').eq('id', m.conversation_id).eq('type', 'private').single();
            if (conv) {
              setMobileShowingChat(true);
              return m.conversation_id;
            }
          }
        }
      }
      const { data: conv, error } = await supabase.from('conversations').insert({ type: 'private', created_by: user.id }).select().single();
      if (error || !conv) { console.error('Create private chat error:', error); return null; }
      
      // Insert self first
      const { error: selfErr } = await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id, role: 'member' as const });
      if (selfErr) { console.error('Add self error:', selfErr); return null; }
      
      // Then other user
      const { error: otherErr } = await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: userId, role: 'member' as const });
      if (otherErr) { console.error('Add other user error:', otherErr); }
      
      await fetchConversations(false);
      setMobileShowingChat(true);
      return conv.id;
    } catch (err: any) {
      console.error('Create private chat error:', err);
      toast.error('Lỗi tạo cuộc trò chuyện');
      return null;
    }
  }, [user, fetchConversations]);

  // BotFather integration
  const botFatherIdRef = useRef<string | null>(null);

  const openBotFatherChat = useCallback(async () => {
    if (!user) return;
    try {
      const { data: ensureData, error: ensureErr } = await supabase.functions.invoke('botfather', {
        body: { action: 'ensure-botfather' },
      });
      if (ensureErr) throw ensureErr;
      if (ensureData?.error) throw new Error(ensureData.error);
      const botfatherId = ensureData.botfather_id;
      botFatherIdRef.current = botfatherId;

      const convId = await createPrivateChat(botfatherId);
      if (convId) {
        setActiveConversationId(convId);
        setMobileShowingChat(true);
      }
    } catch (err: any) {
      toast.error('Lỗi mở BotFather: ' + (err.message || 'Unknown'));
    }
  }, [user, createPrivateChat]);

  const isBotFatherConversation = useCallback((convId: string | null) => {
    if (!convId || !user) return false;
    const conv = conversations.find(c => c.id === convId);
    if (!conv || conv.type !== 'private') return false;
    const otherMember = conv.members.find(m => m.user_id !== user.id);
    if (!otherMember) return false;
    const profile = profilesRef.current[otherMember.user_id];
    return profile?.username === 'botfather';
  }, [conversations, user]);

  const createGroup = useCallback(async (name: string, memberIds: string[]): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data: conv, error } = await supabase.from('conversations').insert({ type: 'group', name, created_by: user.id }).select().single();
      if (error || !conv) { console.error('Create group conv error:', error); toast.error('Lỗi tạo nhóm'); return null; }
      
      // Insert owner FIRST
      const { error: ownerErr } = await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: user.id, role: 'owner' as const });
      if (ownerErr) { console.error('Add owner error:', ownerErr); toast.error('Lỗi thêm chủ nhóm'); return null; }
      
      // Then insert other members one by one to avoid batch RLS issues
      for (const memberId of memberIds) {
        const { error: memberErr } = await supabase.from('conversation_members').insert({ conversation_id: conv.id, user_id: memberId, role: 'member' as const });
        if (memberErr) { console.error(`Add member ${memberId} error:`, memberErr); }
      }
      
      await fetchConversations(false);
      setMobileShowingChat(true);
      return conv.id;
    } catch (err: any) {
      console.error('Create group error:', err);
      toast.error('Lỗi tạo nhóm: ' + (err.message || 'Unknown'));
      return null;
    }
  }, [user, fetchConversations]);

  const clearUnread = useCallback((convId: string) => {
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
    if (id) {
      setMobileShowingChat(true);
      clearUnread(id);
    }
  }, [clearUnread]);

  // Update page title with total unread
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((s, c) => s + c, 0);
    document.title = total > 0 ? `(${total}) Chat` : 'Chat';
  }, [unreadCounts]);

  const toggleInfoPanel = useCallback(() => setShowInfoPanel(p => !p), []);
  const toggleDarkMode = useCallback(() => setDarkMode(p => !p), []);
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  // Friendship functions
  const friends = React.useMemo(() => {
    if (!user) return [];
    return friendships
      .filter(f => f.status === 'accepted')
      .map(f => {
        const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        return profiles[friendId];
      })
      .filter(Boolean) as Profile[];
  }, [friendships, user, profiles]);

  const pendingRequests = React.useMemo(() => {
    if (!user) return [];
    return friendships.filter(f => f.status === 'pending' && f.addressee_id === user.id);
  }, [friendships, user]);

  const sendFriendRequest = useCallback(async (userId: string) => {
    if (!user) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: userId });
    if (error) {
      if (error.code === '23505') toast.error('Đã gửi lời mời kết bạn rồi / Friend request already sent');
      else toast.error('Lỗi / Error: ' + error.message);
      return;
    }
    toast.success('Đã gửi lời mời kết bạn / Friend request sent!');
    fetchFriendships();
  }, [user, fetchFriendships]);

  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', friendshipId);
    toast.success('Đã chấp nhận kết bạn / Friend request accepted!');
    fetchFriendships();
  }, [fetchFriendships]);

  const declineFriendRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    toast.success('Đã từ chối / Declined');
    fetchFriendships();
  }, [fetchFriendships]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    toast.success('Đã huỷ kết bạn / Unfriended');
    fetchFriendships();
  }, [fetchFriendships]);

  const getFriendshipWith = useCallback((userId: string): Friendship | null => {
    if (!user) return null;
    return friendships.find(f =>
      (f.requester_id === user.id && f.addressee_id === userId) ||
      (f.addressee_id === user.id && f.requester_id === userId)
    ) || null;
  }, [friendships, user]);

  const addMemberToGroup = useCallback(async (convId: string, userId: string) => {
    if (!user) return;
    const { error } = await supabase.from('conversation_members').insert({ conversation_id: convId, user_id: userId, role: 'member' as const });
    if (error) {
      toast.error('Lỗi thêm thành viên / Error adding member: ' + error.message);
      return;
    }
    toast.success('Đã thêm thành viên / Member added!');
    fetchConversations(false);
  }, [user, fetchConversations]);

  return (
    <ChatContext.Provider value={{
      conversations, activeConversationId, setActiveConversation,
      messages, sendMessage, searchQuery, setSearchQuery,
      showInfoPanel, toggleInfoPanel, darkMode, toggleDarkMode,
      activeConversation, loadingConversations, loadingMessages,
      profiles, createPrivateChat, createGroup, allProfiles,
      deleteConversation, leaveGroup, ensureSavedMessages,
      isMobileShowingChat, setMobileShowingChat, clearUnread,
      openBotFatherChat, isBotFatherConversation,
      friendships, friends, pendingRequests,
      sendFriendRequest, acceptFriendRequest, declineFriendRequest,
      removeFriend, getFriendshipWith, addMemberToGroup,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
