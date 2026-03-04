import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Mic, MoreVertical, Phone, Search, Info } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatTime, formatLastSeen } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const MessageArea: React.FC = () => {
  const { activeConversation, messages, sendMessage, toggleInfoPanel, profiles, loadingMessages } = useChatContext();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-tg-chat">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Send className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-display font-semibold mb-2">TeleChat</h2>
          <p className="text-muted-foreground text-sm max-w-xs">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
        </motion.div>
      </div>
    );
  }

  const getConvName = () => {
    if (activeConversation.name) return activeConversation.name;
    if (activeConversation.type === 'private' && user) {
      const other = activeConversation.members.find(m => m.user_id !== user.id);
      if (other) return profiles[other.user_id]?.display_name || 'Unknown';
    }
    return 'Chat';
  };

  const getStatusText = () => {
    if (activeConversation.type === 'private' && user) {
      const other = activeConversation.members.find(m => m.user_id !== user.id);
      if (other) {
        const p = profiles[other.user_id];
        if (p?.online) return 'online';
        if (p?.last_seen) return formatLastSeen(new Date(p.last_seen));
        return 'offline';
      }
    }
    return `${activeConversation.members.length} thành viên`;
  };

  const getOtherOnline = () => {
    if (activeConversation.type !== 'private' || !user) return undefined;
    const other = activeConversation.members.find(m => m.user_id !== user.id);
    return other ? profiles[other.user_id]?.online ?? false : false;
  };

  return (
    <div className="flex-1 flex flex-col bg-tg-chat h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-tg-sidebar">
        <ChatAvatar name={getConvName()} online={getOtherOnline()} size="sm" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleInfoPanel}>
          <h3 className="font-semibold text-sm truncate">{getConvName()}</h3>
          <p className={cn('text-xs', getOtherOnline() ? 'text-tg-online' : 'text-muted-foreground')}>
            {getStatusText()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Search className="h-4 w-4 text-muted-foreground" /></button>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Phone className="h-4 w-4 text-muted-foreground" /></button>
          <button onClick={toggleInfoPanel} className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Info className="h-4 w-4 text-muted-foreground" /></button>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isOwn = msg.sender_id === user?.id;
              const showAvatar = !isOwn && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
              const sender = profiles[msg.sender_id];

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}
                >
                  {!isOwn && (
                    <div className="w-8 flex-shrink-0">
                      {showAvatar && sender && <ChatAvatar name={sender.display_name} size="sm" />}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[70%] px-3 py-2 rounded-2xl text-sm relative group',
                      isOwn ? 'bg-tg-message-out rounded-br-md' : 'bg-tg-message-in rounded-bl-md'
                    )}
                    style={{ boxShadow: 'var(--tg-bubble-shadow)' }}
                  >
                    {!isOwn && activeConversation.type !== 'private' && showAvatar && (
                      <p className="text-xs font-medium text-primary mb-0.5">{sender?.display_name}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
                      <span className="text-[10px] text-muted-foreground">{formatTime(new Date(msg.created_at))}</span>
                      {isOwn && <span className="text-[10px]">{msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-tg-sidebar">
        <div className="flex items-end gap-2">
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn..."
              rows={1}
              className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/30 transition-all max-h-32"
              style={{ minHeight: '40px' }}
            />
          </div>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0"><Smile className="h-5 w-5 text-muted-foreground" /></button>
          {input.trim() ? (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={handleSend} className="p-2.5 rounded-full bg-primary hover:bg-primary/90 transition-colors flex-shrink-0">
              <Send className="h-4 w-4 text-primary-foreground" />
            </motion.button>
          ) : (
            <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0"><Mic className="h-5 w-5 text-muted-foreground" /></button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageArea;
