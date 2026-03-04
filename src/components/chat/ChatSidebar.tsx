import React from 'react';
import { Search, Menu, Moon, Sun, Plus } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatTime } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';
import NewChatDialog from './NewChatDialog';

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
}

const ChatSidebar: React.FC = () => {
  const {
    conversations, activeConversationId, setActiveConversation,
    searchQuery, setSearchQuery, darkMode, toggleDarkMode,
    loadingConversations, profiles,
  } = useChatContext();
  const { user, signOut, isAdmin } = useAuth();
  const [showNewChat, setShowNewChat] = React.useState(false);

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.name) return conv.name;
    if (conv.type === 'private' && user) {
      const other = conv.members.find(m => m.user_id !== user.id);
      if (other) {
        const p = profiles[other.user_id];
        return p?.display_name || 'Unknown';
      }
    }
    return 'Chat';
  };

  const getOtherMemberOnline = (conv: ConversationWithDetails) => {
    if (conv.type !== 'private' || !user) return undefined;
    const other = conv.members.find(m => m.user_id !== user.id);
    if (other) return profiles[other.user_id]?.online ?? false;
    return undefined;
  };

  const filtered = conversations.filter(c =>
    getConversationName(c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-tg-sidebar border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-secondary rounded-xl pl-9 pr-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
          {darkMode ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-2">
        <button
          onClick={() => setShowNewChat(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loadingConversations ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {searchQuery ? 'Không tìm thấy' : 'Chưa có cuộc trò chuyện'}
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(c => (
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
                <ChatAvatar
                  name={getConversationName(c)}
                  online={getOtherMemberOnline(c)}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {c.type === 'group' ? '👥 ' : c.type === 'channel' ? '📢 ' : ''}
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

      {/* Footer - user info */}
      <div className="border-t border-border px-4 py-3 flex items-center gap-3">
        <ChatAvatar name={profiles[user?.id || '']?.display_name || 'User'} online={true} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{profiles[user?.id || '']?.display_name || 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">@{profiles[user?.id || '']?.username}</p>
        </div>
        {isAdmin && (
          <a href="/admin" className="text-xs text-primary hover:underline">Admin</a>
        )}
        <button onClick={signOut} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
          Đăng xuất
        </button>
      </div>

      {showNewChat && <NewChatDialog onClose={() => setShowNewChat(false)} />}
    </div>
  );
};

export default ChatSidebar;
