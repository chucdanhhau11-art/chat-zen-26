import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Menu, Moon, Sun, Plus, Shield, Mail, User, Bookmark, Bell, Bot, UserPlus, Check, Clock, MessageCircle, UserMinus, XCircle, Ban, Eye, X } from 'lucide-react';
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
import ProfileViewDialog from './ProfileViewDialog';
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
    allProfiles, createPrivateChat, friends, getFriendshipWith, sendFriendRequest, pendingRequests, acceptFriendRequest, declineFriendRequest,
    cancelFriendRequest, removeFriend, blockUser, unblockUser, isBlocked, isBlockedBy, blockedUsers,
  } = useChatContext();
  const { user, signOut, isAdmin } = useAuth();
  const [showNewChat, setShowNewChat] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showEmailApproval, setShowEmailApproval] = React.useState(false);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBlockedList, setShowBlockedList] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'unfriend' | 'block'; userId: string; name: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const notifIdCounter = useRef(0);

  // Listen for unread count changes to generate notifications
  const prevUnreadRef = useRef<Record<string, number>>({});
  const prevPendingCountRef = useRef(0);

  // Destructured above already
  

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
          conversationId: '',
          conversationName: '👥 Lời mời kết bạn / Friend Request',
          senderName,
          content: `${senderName} đã gửi lời mời kết bạn / sent you a friend request`,
          timestamp: req.created_at,
          read: false,
          type: 'friend_request',
          friendRequestId: req.id,
          requesterId: req.requester_id,
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
        // Sound
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
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Lời mời kết bạn', { body: `${senderName} đã gửi lời mời kết bạn`, icon: '/favicon.ico' }); } catch (e) {}
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
    if (notif.type === 'friend_request') return; // don't navigate for friend requests
    if (notif.conversationId) setActiveConversation(notif.conversationId);
    setShowNotifications(false);
  }, [setActiveConversation]);

  const handleAcceptFriend = useCallback(async (notif: NotificationItem) => {
    if (notif.friendRequestId) {
      await acceptFriendRequest(notif.friendRequestId);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true, friendRequestId: undefined, content: '✅ Đã chấp nhận / Accepted' } : n));
    }
  }, [acceptFriendRequest]);

  const handleRejectFriend = useCallback(async (notif: NotificationItem) => {
    if (notif.friendRequestId) {
      await declineFriendRequest(notif.friendRequestId);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true, friendRequestId: undefined, content: '❌ Đã từ chối / Declined' } : n));
    }
  }, [declineFriendRequest]);

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

  // User search results (only when user presses Enter) - search by username, display_name, or phone_number
  const searchedUsers = userSearchQuery.trim().length >= 2
    ? allProfiles.filter(p => {
        if (p.id === user?.id || p.is_bot) return false;
        if (isBlocked(p.id) || isBlockedBy(p.id)) return false;
        const q = userSearchQuery.toLowerCase();
        const phone = (p as any).phone_number || '';
        return p.display_name.toLowerCase().includes(q) ||
               p.username.toLowerCase().includes(q) ||
               phone.replace(/[\s\-+]/g, '').includes(q.replace(/[\s\-+]/g, ''));
      })
    : [];

  const getFriendStatus = (userId: string) => {
    const fs = getFriendshipWith(userId);
    if (!fs) return 'none';
    if (fs.status === 'accepted') return 'friend';
    if (fs.status === 'pending' && fs.requester_id === user?.id) return 'sent';
    if (fs.status === 'pending' && fs.addressee_id === user?.id) return 'received';
    return 'none';
  };

  const handleUserChat = async (userId: string) => {
    const convId = await createPrivateChat(userId);
    if (convId) setActiveConversation(convId);
  };

  const filtered = conversations.filter(c => {
    if (!getConversationName(c).toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (c.type === 'private' && c.name !== 'Saved Messages' && !c.lastMessage) {
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
                <button onClick={() => { setShowMenu(false); setShowBlockedList(true); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                  <Ban className="h-4 w-4 text-destructive" />
                  <span>Người dùng đã chặn</span>
                  {blockedUsers.length > 0 && <span className="text-[10px] text-muted-foreground ml-auto">{blockedUsers.length}</span>}
                </button>
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
          <input type="text" placeholder="Tìm kiếm (Enter)..." value={localSearch}
            onChange={e => { const v = e.target.value; setLocalSearch(v); setSearchQuery(v); if (!v.trim()) setUserSearchQuery(''); }}
            onKeyDown={e => { if (e.key === 'Enter') setUserSearchQuery(localSearch.trim()); }}
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

        {/* User search results */}
        {searchQuery.trim().length >= 2 && searchedUsers.length > 0 && (
          <>
            <div className="px-4 pt-2 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Người dùng / Users
              </p>
            </div>
            {searchedUsers.map(p => {
              const status = getFriendStatus(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-tg-hover"
                >
                  <ChatAvatar name={p.display_name} online={p.online ?? false} size="md" />
                  <div className="flex-1 min-w-0 mr-1">
                    <p className="text-sm font-medium truncate">{p.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {status === 'none' && (
                      <button
                        onClick={() => sendFriendRequest(p.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        <UserPlus className="h-3 w-3" /> Kết bạn
                      </button>
                    )}
                    {status === 'sent' && (
                      <button
                        onClick={() => { const fs = getFriendshipWith(p.id); if (fs) cancelFriendRequest(fs.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[11px] hover:bg-destructive/10 hover:text-destructive transition-colors whitespace-nowrap"
                      >
                        <XCircle className="h-3 w-3" /> Đã gửi
                      </button>
                    )}
                    {status === 'received' && (
                      <button
                        onClick={() => { const fs = getFriendshipWith(p.id); if (fs) acceptFriendRequest(fs.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        <Check className="h-3 w-3" /> Chấp nhận
                      </button>
                    )}
                    {status === 'friend' && (
                      <button
                        onClick={() => setConfirmAction({ type: 'unfriend', userId: p.id, name: p.display_name })}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[11px] hover:bg-destructive/10 hover:text-destructive transition-colors whitespace-nowrap"
                      >
                        <UserMinus className="h-3 w-3" /> Bạn bè
                      </button>
                    )}
                    <button onClick={() => setViewProfileUserId(p.id)} className="p-1 rounded-lg hover:bg-tg-hover transition-colors" title="Xem profile">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleUserChat(p.id)} className="p-1 rounded-lg hover:bg-tg-hover transition-colors" title="Nhắn tin">
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setConfirmAction({ type: 'block', userId: p.id, name: p.display_name })} className="p-1 rounded-lg hover:bg-destructive/10 transition-colors" title="Chặn">
                      <Ban className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
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
      {viewProfileUserId && <ProfileViewDialog userId={viewProfileUserId} onClose={() => setViewProfileUserId(null)} />}
      <AnimatePresence>
        {showNotifications && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
            onClear={handleClearNotifications}
            onClickNotification={handleClickNotification}
            onMarkAllRead={handleMarkAllRead}
            onAcceptFriend={handleAcceptFriend}
            onRejectFriend={handleRejectFriend}
          />
        )}
      </AnimatePresence>

      {/* Blocked users dialog */}
      <AnimatePresence>
        {showBlockedList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowBlockedList(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                  <Ban className="h-4 w-4 text-destructive" />
                  Người dùng đã chặn / Blocked Users
                </h3>
                <button onClick={() => setShowBlockedList(false)} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              {blockedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Chưa chặn ai / No blocked users</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {blockedUsers.map(uid => {
                    const p = profiles[uid];
                    if (!p) return null;
                    return (
                      <div key={uid} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/50">
                        <ChatAvatar name={p.display_name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.display_name}</p>
                          <p className="text-xs text-muted-foreground">@{p.username}</p>
                        </div>
                        <button
                          onClick={() => unblockUser(uid)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors"
                        >
                          Bỏ chặn
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm action dialog */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-xs p-5 text-center"
            >
              <p className="text-sm font-medium mb-1">
                {confirmAction.type === 'unfriend' ? 'Huỷ kết bạn / Unfriend' : 'Chặn / Block'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {confirmAction.type === 'unfriend'
                  ? `Bạn có chắc muốn huỷ kết bạn với ${confirmAction.name}?`
                  : `Bạn có chắc muốn chặn ${confirmAction.name}?`}
              </p>
              <div className="flex items-center gap-2 justify-center">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.type === 'unfriend') {
                      const fs = getFriendshipWith(confirmAction.userId);
                      if (fs) removeFriend(fs.id);
                    } else {
                      blockUser(confirmAction.userId);
                    }
                    setConfirmAction(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  Xác nhận
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatSidebar;
