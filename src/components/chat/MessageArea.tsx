import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Mic, MoreVertical, Phone, Search, Info } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { CURRENT_USER } from '@/data/mockData';
import ChatAvatar from './ChatAvatar';
import { formatTime, formatLastSeen } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const MessageArea: React.FC = () => {
  const { activeConversation, activeConversationId, messages, sendMessage, toggleInfoPanel } = useChatContext();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const handleSend = () => {
    if (!input.trim() || !activeConversationId) return;
    sendMessage(activeConversationId, input.trim());
    setInput('');
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
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Send className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-display font-semibold mb-2">TeleChat</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Chọn một cuộc trò chuyện để bắt đầu nhắn tin
          </p>
        </motion.div>
      </div>
    );
  }

  const otherMember = activeConversation.type === 'private'
    ? activeConversation.members.find(m => m.id !== CURRENT_USER.id)
    : undefined;

  const statusText = activeConversation.type === 'private'
    ? otherMember?.online
      ? 'online'
      : otherMember?.lastSeen
        ? formatLastSeen(otherMember.lastSeen)
        : 'offline'
    : `${activeConversation.members.length} thành viên`;

  return (
    <div className="flex-1 flex flex-col bg-tg-chat h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-tg-sidebar">
        <ChatAvatar name={activeConversation.name} online={otherMember?.online} size="sm" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleInfoPanel}>
          <h3 className="font-semibold text-sm truncate">{activeConversation.name}</h3>
          <p className={cn(
            'text-xs',
            otherMember?.online ? 'text-tg-online' : 'text-muted-foreground'
          )}>
            {statusText}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <Phone className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={toggleInfoPanel} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <Info className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, i) => {
            const isOwn = msg.senderId === CURRENT_USER.id;
            const showAvatar = !isOwn && (
              i === 0 || chatMessages[i - 1].senderId !== msg.senderId
            );
            const sender = activeConversation.members.find(m => m.id === msg.senderId);

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
                    {showAvatar && sender && (
                      <ChatAvatar name={sender.displayName} size="sm" />
                    )}
                  </div>
                )}
                <div className={cn(
                  'max-w-[70%] px-3 py-2 rounded-2xl text-sm relative group',
                  isOwn
                    ? 'bg-tg-message-out rounded-br-md'
                    : 'bg-tg-message-in rounded-bl-md',
                )}
                  style={{ boxShadow: 'var(--tg-bubble-shadow)' }}
                >
                  {!isOwn && activeConversation.type !== 'private' && showAvatar && (
                    <p className="text-xs font-medium text-primary mb-0.5">{sender?.displayName}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <div className={cn(
                    'flex items-center gap-1 mt-1',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </span>
                    {isOwn && (
                      <span className="text-[10px]">
                        {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-tg-sidebar">
        <div className="flex items-end gap-2">
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1 relative">
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
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0">
            <Smile className="h-5 w-5 text-muted-foreground" />
          </button>
          {input.trim() ? (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={handleSend}
              className="p-2.5 rounded-full bg-primary hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </motion.button>
          ) : (
            <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0">
              <Mic className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageArea;
