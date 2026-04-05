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
  cancelFriendRequest: (friendshipId: string) => Promise<void>;
  getFriendshipWith: (userId: string) => Friendship | null;
  addMemberToGroup: (convId: string, userId: string) => Promise<void>;
  // Block
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
  isBlockedBy: (userId: string) => boolean;
  blockedUsers: string[];
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
  const conversationsRef = useRef<ConversationWithDetails[]>([]);
  const conversationIdsRef = useRef<string[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);
  const activeMessagesFetchIdRef = useRef(0);

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const acceptFriendRequestRef = useRef<(id: string) => Promise<void>>();

  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  useEffect(() => {
    conversationsRef.current = conversations;
    conversationIdsRef.current = conversations.map(conv => conv.id);
  }, [conversations]);
  useEffect(() => { activeConversationIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { unreadCountsRef.current = unreadCounts; }, [unreadCounts]);

  const sortConversationsByRecent = useCallback((items: ConversationWithDetails[]) => {
    return [...items].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.lastMessage?.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.lastMessage?.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, []);

  const mergeConversationMessage = useCallback((message: Message) => {
    setConversations(prev => {
      let changed = false;
      const next = prev.map(conv => {
        if (conv.id !== message.conversation_id) return conv;
        changed = true;
        return {
          ...conv,
          updated_at: message.created_at,
          lastMessage: {
            ...message,
            sender: profilesRef.current[message.sender_id],
          },
        };
      });

      return changed ? sortConversationsByRecent(next) : prev;
    });
  }, [sortConversationsByRecent]);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships' }, 
        (payload: any) => {
          const newFs = payload.new;
          // Show interactive toast for incoming friend request
          if (newFs && newFs.addressee_id === user.id && newFs.status === 'pending') {
            const requesterProfile = profilesRef.current[newFs.requester_id];
            const requesterName = requesterProfile?.display_name || 'Người dùng';
            playNotificationSound();
            toast(requesterName + ' muốn kết bạn', {
              description: 'Bạn có lời mời kết bạn mới',
              duration: 8000,
              action: {
                label: 'Chấp nhận',
                onClick: () => {
                  acceptFriendRequestRef.current?.(newFs.id);
                },
              },
            });
          }
          fetchFriendships();
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships' },
        (payload: any) => {
          const updated = payload.new;
          // Notify when friend request is accepted
          if (updated && updated.requester_id === user.id && updated.status === 'accepted') {
            const friendProfile = profilesRef.current[updated.addressee_id];
            const friendName = friendProfile?.display_name || 'Người dùng';
            toast.success(friendName + ' đã chấp nhận kết bạn!');
          }
          fetchFriendships();
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friendships' }, () => {
        fetchFriendships();
      })
      .subscribe();
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

  const fetchConversationsLock = useRef(false);
  const fetchConversations = useCallback(async (showLoading = false) => {
    if (!user) return;
    if (fetchConversationsLock.current) return;
    fetchConversationsLock.current = true;
    if (showLoading) setLoadingConversations(true);

    try {
      const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
      if (!memberships || memberships.length === 0) {
        setConversations([]);
        unreadCountsRef.current = {};
        setUnreadCounts({});
        setLoadingConversations(false);
        initialLoadDone.current = true;
        return;
      }
      const convIds = memberships.map(m => m.conversation_id);

      // Batch fetch: conversations, all members, last messages, unread counts
      const [convsRes, allMembersRes, lastMessagesRes] = await Promise.all([
        supabase.from('conversations').select('*').in('id', convIds).order('updated_at', { ascending: false }),
        supabase.from('conversation_members').select('*').in('conversation_id', convIds),
        // Get recent messages for all conversations at once (last 1 per conv via ordering)
        supabase.from('messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: false }),
      ]);

      const convs = convsRes.data;
      if (!convs) { setLoadingConversations(false); initialLoadDone.current = true; return; }
      const allMembers = allMembersRes.data || [];
      const allRecentMessages = lastMessagesRes.data || [];

      // Build last message map (first occurrence per conversation_id is the latest)
      const lastMsgMap: Record<string, Message> = {};
      for (const msg of allRecentMessages) {
        if (!lastMsgMap[msg.conversation_id]) {
          lastMsgMap[msg.conversation_id] = msg;
        }
      }

      // Build unread count map from recent messages
      const unreadMap: Record<string, number> = {};
      for (const msg of allRecentMessages) {
        if (msg.sender_id !== user.id && msg.status !== 'read') {
          unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] || 0) + 1;
        }
      }

      const currentProfiles = profilesRef.current;
      const conversationsWithDetails: ConversationWithDetails[] = convs.map(conv => {
        const members = allMembers.filter(m => m.conversation_id === conv.id).map(m => ({ ...m, profile: currentProfiles[m.user_id] }));
        const lastMsg = lastMsgMap[conv.id];
        const lastMessage = lastMsg ? { ...lastMsg, sender: currentProfiles[lastMsg.sender_id] } : undefined;
        const unread = unreadMap[conv.id] || unreadCountsRef.current[conv.id] || 0;
        unreadCountsRef.current[conv.id] = unread;
        return { ...conv, members, lastMessage, unreadCount: unread };
      });

      setConversations(sortConversationsByRecent(conversationsWithDetails));
      setUnreadCounts({ ...unreadCountsRef.current });
    } catch (err) {
      console.error('fetchConversations error:', err);
    } finally {
      setLoadingConversations(false);
      initialLoadDone.current = true;
      fetchConversationsLock.current = false;
    }
  }, [user, sortConversationsByRecent]);

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

  // Debounced fetch to prevent rapid-fire refetches from realtime events
  const debouncedFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetchConversations = useCallback(() => {
    if (debouncedFetchRef.current) clearTimeout(debouncedFetchRef.current);
    debouncedFetchRef.current = setTimeout(() => fetchConversations(false), 500);
  }, [fetchConversations]);

  useEffect(() => {
    return () => {
      if (debouncedFetchRef.current) clearTimeout(debouncedFetchRef.current);
    };
  }, []);

  // Listen only for membership changes related to current user to avoid global refetch loops
  useEffect(() => {
    if (!user) return;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectChannel = (channelName: string) => {
      const nextChannel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_members',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            debouncedFetchConversations();
          }
        );

      nextChannel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('conversation-members channel error, reconnecting...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            supabase.removeChannel(nextChannel);
            channel = connectChannel(`conversation-members:${user.id}:${Date.now()}`);
          }, 2000);
        }
      });

      return nextChannel;
    };

    let channel = connectChannel(`conversation-members:${user.id}`);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      supabase.removeChannel(channel);
    };
  }, [user, debouncedFetchConversations]);

  const realtimeConversationIds = React.useMemo(
    () => [...new Set(conversations.map(conv => conv.id))].sort(),
    [conversations]
  );
  const realtimeConversationIdsKey = realtimeConversationIds.join(',');

  // Global listener for new messages → unread counts + notification sound
  useEffect(() => {
    if (!user || realtimeConversationIds.length === 0) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleInsert = (payload: RealtimePostgresChangesPayload<Message>) => {
      const newMsg = payload.new as Message;
      if (!newMsg) return;

      mergeConversationMessage(newMsg);

      if (newMsg.sender_id === user.id) return;
      if (activeConversationIdRef.current === newMsg.conversation_id) return;

      const newCount = (unreadCountsRef.current[newMsg.conversation_id] || 0) + 1;
      unreadCountsRef.current = { ...unreadCountsRef.current, [newMsg.conversation_id]: newCount };
      setUnreadCounts(prev => ({ ...prev, [newMsg.conversation_id]: newCount }));
      playNotificationSound();

      const senderProfile = profilesRef.current[newMsg.sender_id];
      const senderName = senderProfile?.display_name || 'Tin nhắn mới';
      const msgContent = newMsg.content || '📎 File';
      showBrowserNotification(senderName, msgContent);

      const convId = newMsg.conversation_id;
      const toastId = toast(senderName, {
        description: msgContent.length > 60 ? msgContent.slice(0, 60) + '…' : msgContent,
        duration: 5000,
        action: {
          label: 'Xem',
          onClick: () => {
            setActiveConversationId(convId);
            setMobileShowingChat(true);
          },
        },
      });

      setTimeout(() => {
        const toastEl = document.querySelector(`[data-sonner-toast][data-toast-id="${toastId}"]`) as HTMLElement;
        if (toastEl) {
          toastEl.style.cursor = 'pointer';
          toastEl.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button')) return;
            setActiveConversationId(convId);
            setMobileShowingChat(true);
            toast.dismiss(toastId);
          }, { once: true });
        }
      }, 100);
    };

    const connectChannel = (channelName: string) => {
      let nextChannel = supabase.channel(channelName);

      realtimeConversationIds.forEach((conversationId) => {
        nextChannel = nextChannel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          handleInsert
        );
      });

      nextChannel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('global-messages channel error, reconnecting...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            supabase.removeChannel(nextChannel);
            channel = connectChannel(`global-messages:${user.id}:${Date.now()}`);
          }, 2000);
        }
      });

      return nextChannel;
    };

    let channel = connectChannel(`global-messages:${user.id}:${realtimeConversationIds.length}`);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      supabase.removeChannel(channel);
    };
  }, [user, realtimeConversationIds, realtimeConversationIdsKey, mergeConversationMessage]);

  // Reconnect realtime + refetch data when tab becomes visible again
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Refetch conversations to catch any missed updates
        fetchConversations(false);
        fetchFriendships();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Also reconnect on network online event
    const handleOnline = () => {
      fetchConversations(false);
      fetchFriendships();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, fetchConversations, fetchFriendships]);


  const userIdRef = useRef<string | null>(null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);

  useEffect(() => {
    if (!activeConversationId || !userIdRef.current) {
      activeMessagesFetchIdRef.current += 1;
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    let cancelled = false;
    const fetchId = ++activeMessagesFetchIdRef.current;

    const fetchMessages = async () => {
      setLoadingMessages(true);

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeConversationId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (cancelled || fetchId !== activeMessagesFetchIdRef.current) return;

        if (error) {
          console.error('fetchMessages error:', error);
          setMessages([]);
          return;
        }

        setMessages(data || []);
      } finally {
        if (!cancelled && fetchId === activeMessagesFetchIdRef.current) {
          setLoadingMessages(false);
        }
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  // Realtime messages
  useEffect(() => {
    if (!activeConversationId) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (payload: RealtimePostgresChangesPayload<Message>) => {
      if (payload.eventType === 'INSERT') {
        const inserted = payload.new as Message;
        setMessages(prev => prev.some(message => message.id === inserted.id) ? prev : [...prev, inserted]);
        mergeConversationMessage(inserted);
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        mergeConversationMessage(updated);
      } else if (payload.eventType === 'DELETE') {
        const old = payload.old as any;
        if (old?.id) {
          setMessages(prev => prev.filter(m => m.id !== old.id));
          debouncedFetchConversations();
        }
      }
    };

    const connectChannel = (channelName: string) => {
      const nextChannel = supabase.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversationId}` }, handler);

      nextChannel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`messages:${activeConversationId} channel error, reconnecting...`);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            supabase.removeChannel(nextChannel);
            channel = connectChannel(`messages:${activeConversationId}:${Date.now()}`);
          }, 2000);
        }
      });

      return nextChannel;
    };

    let channel = connectChannel(`messages:${activeConversationId}`);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, debouncedFetchConversations, mergeConversationMessage]);

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
    unreadCountsRef.current = { ...unreadCountsRef.current, [convId]: 0 };
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
    
    // Mark messages as read in DB
    if (user) {
      supabase.from('messages')
        .update({ status: 'read' })
        .eq('conversation_id', convId)
        .neq('sender_id', user.id)
        .neq('status', 'read')
        .then(() => {});
    }
  }, [user]);

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
  acceptFriendRequestRef.current = acceptFriendRequest;

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

  const cancelFriendRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    toast.success('Đã huỷ lời mời / Request cancelled');
    fetchFriendships();
  }, [fetchFriendships]);

  const getFriendshipWith = useCallback((userId: string): Friendship | null => {
    if (!user) return null;
    return friendships.find(f =>
      (f.requester_id === user.id && f.addressee_id === userId) ||
      (f.addressee_id === user.id && f.requester_id === userId)
    ) || null;
  }, [friendships, user]);

  // Block/unblock
  const myProfile = user ? profiles[user.id] : null;
  const blockedUsers = myProfile?.blocked_users || [];

  const isBlocked = useCallback((userId: string) => {
    return blockedUsers.includes(userId);
  }, [blockedUsers]);

  const isBlockedBy = useCallback((userId: string) => {
    const theirProfile = profiles[userId];
    return theirProfile?.blocked_users?.includes(user?.id || '') ?? false;
  }, [profiles, user]);

  const blockUser = useCallback(async (userId: string) => {
    if (!user) return;
    const newBlocked = [...new Set([...blockedUsers, userId])];
    await supabase.from('profiles').update({ blocked_users: newBlocked }).eq('id', user.id);
    setProfiles(prev => ({ ...prev, [user.id]: { ...prev[user.id], blocked_users: newBlocked } }));
    // Also remove friendship if exists
    const fs = friendships.find(f =>
      (f.requester_id === user.id && f.addressee_id === userId) ||
      (f.addressee_id === user.id && f.requester_id === userId)
    );
    if (fs) await supabase.from('friendships').delete().eq('id', fs.id);
    fetchFriendships();
    toast.success('Đã chặn người dùng / User blocked');
  }, [user, blockedUsers, friendships, fetchFriendships]);

  const unblockUser = useCallback(async (userId: string) => {
    if (!user) return;
    const newBlocked = blockedUsers.filter(id => id !== userId);
    await supabase.from('profiles').update({ blocked_users: newBlocked }).eq('id', user.id);
    setProfiles(prev => ({ ...prev, [user.id]: { ...prev[user.id], blocked_users: newBlocked } }));
    toast.success('Đã bỏ chặn / User unblocked');
  }, [user, blockedUsers]);

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
      removeFriend, cancelFriendRequest, getFriendshipWith, addMemberToGroup,
      blockUser, unblockUser, isBlocked, isBlockedBy, blockedUsers,
    }}>
      {children}
    </ChatContext.Provider>
  );
};
