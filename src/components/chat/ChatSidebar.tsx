import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Menu, Moon, Sun, Plus, Shield, Mail, User, Bookmark, Bell, Bot } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatTime } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';
import NewChatDialog from './NewChatDialog';
import AdminEmailApproval from './AdminEmailApproval';
import EditProfileDialog from './EditProfileDialog';
import NotificationPanel, { type NotificationItem } from './NotificationPanel';

type ConversationMember = Tables<'conversation_members'>;
type Profile = Tables<'profiles'>;

interface ConversationWithDetails {
  id: string;
  type: string;
  name: string | null;
  members: (ConversationMember & { profile?: Profile })[];
  lastMessage?: any;
  unreadCount: number;
  pinned?: boolean | null;
  created_by?: string | null;
}

const ChatSidebar: React.FC = () => {
  const {
    conversations, activeConversationId, setActiveConversation,
    searchQuery, setSearchQuery, darkMode, toggleDarkMode,
    loadingConversations, profiles, ensureSavedMessages, openBotFatherChat,
  } = useChatContext();
  const { user, signOut, isAdmin } = useAuth();
  const [showNewChat, setShowNewChat] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showEmailApproval, setShowEmailApproval] = React.useState(false);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifIdCounter = useRef(0);

  // Listen for unread count changes to generate notifications
  const prevUnreadRef = useRef<Record<string, number>>({});
  const prevPendingCountRef = useRef(0);

  // Friend request notifications
  const { pendingRequests, friends, friendships } = useChatContext();

  useEffect(() => {
    if (pendingRequests.length > prevPendingCountRef.current) {
      // New friend requests arrived
      const newCount = pendingRequests.length - prevPendingCountRef.current;
      for (let i = 0; i < newCount; i++) {
        const req = pendingRequests[i];
        if (!req) continue;
        const senderName = profiles[req.requester_id]?.display_name || 'Unknown';
        notifIdCounter.current++;
        const newNotif: NotificationItem = {
          id: `notif-fr-${notifIdCounter.current}-${Date.now()}`,
          conversationId: '', // no conversation
          conversationName: '👥 Lời mời kết bạn / Friend Request',
          senderName,
          content: `${senderName} đã gửi lời mời kết bạn / sent you a friend request`,
          timestamp: req.created_at,
          read: false,
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.type = 'sine'; osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
          osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } catch (e) {}
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Lời mời kết bạn / Friend Request', { body: `${senderName} đã gửi lời mời kết bạn`, icon: '/favicon.ico' }); } catch (e) {}
        }
      }
    }
    prevPendingCountRef.current = pendingRequests.length;
  }, [pendingRequests, profiles]);
  
  useEffect(() => {
    // When conversations update with new unread, create notification entries
    conversations.forEach(c => {
      if (c.unreadCount > (prevUnreadRef.current[c.id] || 0) && c.lastMessage && c.lastMessage.sender_id !== user?.id) {
        const convName = c.name === 'Saved Messages' ? '📌 Saved Messages' : c.name || (c.type === 'private' ? (() => {
          const other = c.members.find(m => m.user_id !== user?.id);
          return other ? (profiles[other.user_id]?.display_name || 'Unknown') : 'Chat';
        })() : c.name || 'Chat');
        
        const senderName = profiles[c.lastMessage.sender_id]?.display_name || 'Unknown';
        
        notifIdCounter.current++;
        const newNotif: NotificationItem = {
          id: `notif-${notifIdCounter.current}-${Date.now()}`,
          conversationId: c.id,
          conversationName: convName,
          senderName,
          content: c.lastMessage.content || '📎 File',
          timestamp: c.lastMessage.created_at,
          read: false,
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
      }
    });
    const map: Record<string, number> = {};
    conversations.forEach(c => { map[c.id] = c.unreadCount; });
    prevUnreadRef.current = map;
  }, [conversations, user, profiles]);

  const totalUnreadNotifs = notifications.filter(n => !n.read).length;

  const handleClickNotification = useCallback((notif: NotificationItem) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    setActiveConversation(notif.conversationId);
    setShowNotifications(false);
  }, [setActiveConversation]);

  const handleMarkAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const handleClearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.name === 'Saved Messages') return '📌 Saved Messages';
    if (conv.name) return conv.name;
    if (conv.type === 'private' && user) {
      const other = conv.members.find(m => m.user_id !== user.id);
      if (other) return profiles[other.user_id]?.display_name || 'Unknown';
    }
    return 'Chat';
  };

  const getOtherMemberOnline = (conv: ConversationWithDetails) => {
    if (conv.name === 'Saved Messages') return undefined;
    if (conv.type !== 'private' || !user) return undefined;
    const other = conv.members.find(m => m.user_id !== user.id);
    if (other) return profiles[other.user_id]?.online ?? false;
    return undefined;
  };

  const filtered = conversations.filter(c => {
    if (!getConversationName(c).toLowerCase().includes(searchQuery.toLowerCase())) return false;
    // Hide private chats with no messages (except Saved Messages) so the other user only sees it after a message is sent
    if (c.type === 'private' && c.name !== 'Saved Messages' && !c.lastMessage) {
      // Only show to the creator
      if (c.created_by !== user?.id) return false;
    }
    return true;
  });

  // Sort: Saved Messages always first, then pinned, then rest
  const sorted = [...filtered].sort((a, b) => {
    const aIsSaved = a.name === 'Saved Messages';
    const bIsSaved = b.name === 'Saved Messages';
    if (aIsSaved && !bIsSaved) return -1;
    if (!aIsSaved && bIsSaved) return 1;
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full bg-tg-sidebar border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="relative">
          <button onClick={() => setShowMenu(p => !p)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <button onClick={() => { setShowMenu(false); setShowEditProfile(true); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                  <User className="h-4 w-4 text-primary" />
                  <span>Chỉnh sửa Profile</span>
                </button>
                <button onClick={async () => { setShowMenu(false); await ensureSavedMessages(); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                  <Bookmark className="h-4 w-4 text-primary" />
                  <span>Saved Messages</span>
                </button>
                <a href="/bots" onClick={() => setShowMenu(false)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                  <Bot className="h-4 w-4 text-primary" />
                  <span>Bot Management</span>
                </a>
                <button onClick={async () => { setShowMenu(false); await openBotFatherChat(); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                  <Bot className="h-4 w-4 text-primary" />
                  <span>🤖 BotFather</span>
                </button>
                {isAdmin && (
                  <>
                    <div className="border-t border-border" />
                    <button onClick={() => { setShowMenu(false); setShowEmailApproval(true); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                      <Mail className="h-4 w-4 text-primary" />
                      <span>Duyệt email đăng ký</span>
                    </button>
                    <a href="/admin" onClick={() => setShowMenu(false)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Admin Dashboard</span>
                    </a>
                  </>
                )}
                <div className="border-t border-border" />
                <button onClick={() => { toggleDarkMode(); setShowMenu(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                  {darkMode ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                  <span>{darkMode ? 'Chế độ sáng' : 'Chế độ tối'}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Tìm kiếm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-secondary rounded-xl pl-9 pr-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all" />
        </div>
        <div className="relative">
          <button onClick={() => setShowNotifications(true)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors relative">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {totalUnreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-tg-unread text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {totalUnreadNotifs}
              </span>
            )}
          </button>
        </div>
        <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
          {darkMode ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-2">
        <button onClick={() => setShowNewChat(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
          <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? 'Không tìm thấy' : 'Chưa có cuộc trò chuyện'}
          </div>
        ) : (
          <AnimatePresence>
            {sorted.map(c => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveConversation(c.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                  c.id === activeConversationId ? 'bg-primary/10' : 'hover:bg-tg-hover'
                )}
              >
                <ChatAvatar name={c.name === 'Saved Messages' ? 'Saved' : getConversationName(c).replace('📌 ', '').replace('👥 ', '').replace('📢 ', '')} online={getOtherMemberOnline(c)} size="md" isBot={c.type === 'private' && c.name !== 'Saved Messages' && !!c.members.find(m => m.user_id !== user?.id && profiles[m.user_id]?.is_bot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {c.type === 'group' && c.name !== 'Saved Messages' ? '👥 ' : c.type === 'channel' ? '📢 ' : ''}
                      {getConversationName(c)}
                    </span>
                    {c.lastMessage && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatTime(new Date(c.lastMessage.created_at))}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.lastMessage?.content || 'Chưa có tin nhắn'}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="bg-tg-unread text-primary-foreground text-xs font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                    {c.unreadCount}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 flex items-center gap-3">
        <ChatAvatar name={profiles[user?.id || '']?.display_name || 'User'} online={true} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{profiles[user?.id || '']?.display_name || 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">@{profiles[user?.id || '']?.username}</p>
        </div>
        <button onClick={signOut} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Đăng xuất</button>
      </div>

      {showNewChat && <NewChatDialog onClose={() => setShowNewChat(false)} />}
      {showEmailApproval && <AdminEmailApproval onClose={() => setShowEmailApproval(false)} />}
      {showEditProfile && <EditProfileDialog onClose={() => setShowEditProfile(false)} />}
      <AnimatePresence>
        {showNotifications && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
            onClear={handleClearNotifications}
            onClickNotification={handleClickNotification}
            onMarkAllRead={handleMarkAllRead}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatSidebar;
