import React from 'react';
import { Search, Menu, Moon, Sun } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { Conversation } from '@/data/mockData';
import ChatAvatar from './ChatAvatar';
import { formatTime } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const ChatSidebar: React.FC = () => {
  const {
    conversations, activeConversationId, setActiveConversation,
    searchQuery, setSearchQuery, darkMode, toggleDarkMode,
  } = useChatContext();

  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

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

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {pinned.length > 0 && (
          <div>
            {pinned.map(c => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeConversationId}
                onClick={() => setActiveConversation(c.id)}
              />
            ))}
            <div className="mx-4 border-b border-border" />
          </div>
        )}
        <AnimatePresence>
          {unpinned.map(c => (
            <ConversationItem
              key={c.id}
              conversation={c}
              active={c.id === activeConversationId}
              onClick={() => setActiveConversation(c.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ConversationItem: React.FC<{
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}> = ({ conversation, active, onClick }) => {
  const otherMember = conversation.type === 'private'
    ? conversation.members.find(m => m.id !== '1')
    : undefined;

  const typeIcon = conversation.type === 'group' ? '👥' : conversation.type === 'channel' ? '📢' : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
        active ? 'bg-primary/10' : 'hover:bg-tg-hover'
      )}
    >
      <ChatAvatar
        name={conversation.name}
        online={otherMember?.online}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">
            {typeIcon} {conversation.name}
          </span>
          {conversation.lastMessage && (
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {formatTime(conversation.lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {conversation.lastMessage?.text || 'Chưa có tin nhắn'}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 bg-tg-unread text-primary-foreground text-xs font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
              {conversation.unreadCount}
            </span>
          )}
          {conversation.muted && conversation.unreadCount === 0 && (
            <span className="text-muted-foreground text-xs">🔇</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatSidebar;
