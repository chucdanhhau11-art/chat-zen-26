import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Smile, Paperclip, Mic, MoreVertical, Phone, Search, Info, X, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatTime, formatLastSeen } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const isImageType = (type: string) => type.startsWith('image/');
const isVideoType = (type: string) => type.startsWith('video/');

// Notification sound
const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Telegram-like notification: two quick ascending tones
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
  } catch (e) {
    // Silently fail if audio not supported
  }
};

const MessageBubbleFile: React.FC<{ msg: any; isOwn: boolean }> = ({ msg, isOwn }) => {
  const fileUrl = msg.file_url;
  const fileName = msg.file_name || 'file';
  const fileSize = msg.file_size;
  const msgType = msg.message_type;

  if (msgType === 'image' && fileUrl) {
    return (
      <div className="max-w-xs">
        <img src={fileUrl} alt={fileName} className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer" onClick={() => window.open(fileUrl, '_blank')} />
        {msg.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
      </div>
    );
  }

  if (msgType === 'video' && fileUrl) {
    return (
      <div className="max-w-xs">
        <video src={fileUrl} controls className="rounded-lg max-w-full max-h-64" />
        {msg.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
      </div>
    );
  }

  if (msgType === 'file' && fileUrl) {
    const sizeStr = fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : '';
    return (
      <div>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-background/30 hover:bg-background/50 transition-colors">
          <FileText className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            {sizeStr && <p className="text-[10px] text-muted-foreground">{sizeStr}</p>}
          </div>
        </a>
        {msg.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
};

// Link detection
const renderContent = (content: string | null) => {
  if (!content) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all">
          {part}
        </a>
      );
    }
    return part;
  });
};

const MessageArea: React.FC = () => {
  const { activeConversation, messages, sendMessage, toggleInfoPanel, profiles, loadingMessages, deleteConversation } = useChatContext();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLenRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Play sound on new incoming message
  useEffect(() => {
    if (messages.length > prevMessagesLenRef.current && prevMessagesLenRef.current > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== user?.id) {
        playNotificationSound();
      }
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length, user?.id]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (!activeConversation || !user || messages.length === 0) return;
    const unreadFromOthers = messages.filter(
      m => m.sender_id !== user.id && m.status !== 'read'
    );
    if (unreadFromOthers.length > 0) {
      const ids = unreadFromOthers.map(m => m.id);
      supabase
        .from('messages')
        .update({ status: 'read' })
        .in('id', ids)
        .then();
    }
  }, [messages, activeConversation, user]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File quá lớn. Tối đa 20MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewFile({ file, url });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const cancelPreview = useCallback(() => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  }, [previewFile]);

  const uploadAndSend = useCallback(async () => {
    if (!previewFile || !user || !activeConversation) return;
    setUploading(true);
    try {
      const file = previewFile.file;
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      let messageType = 'file';
      if (isImageType(file.type)) messageType = 'image';
      else if (isVideoType(file.type)) messageType = 'video';

      await supabase.from('messages').insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content: input.trim() || null,
        message_type: messageType,
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
      });

      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversation.id);

      setInput('');
      cancelPreview();
    } catch (err: any) {
      toast.error('Lỗi upload: ' + (err.message || 'Unknown'));
    } finally {
      setUploading(false);
    }
  }, [previewFile, user, activeConversation, input, cancelPreview]);

  const handleSend = async () => {
    if (previewFile) {
      await uploadAndSend();
      return;
    }
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

  const handleDeleteConversation = async () => {
    if (!activeConversation) return;
    const confirmText = activeConversation.type === 'private' ? 'Xoá cuộc trò chuyện này?' : 'Xoá nhóm trò chuyện này?';
    if (window.confirm(confirmText)) {
      await deleteConversation(activeConversation.id);
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
        {/* App name */}
        <span className="text-[10px] font-display font-semibold text-muted-foreground/60 tracking-wider uppercase mr-1 hidden sm:inline">TeleChat</span>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Search className="h-4 w-4 text-muted-foreground" /></button>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Phone className="h-4 w-4 text-muted-foreground" /></button>
          <button onClick={toggleInfoPanel} className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Info className="h-4 w-4 text-muted-foreground" /></button>
          <button onClick={handleDeleteConversation} className="p-2 rounded-lg hover:bg-tg-hover transition-colors" title="Xoá cuộc trò chuyện">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
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
                    {msg.message_type === 'text' ? (
                      <p className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</p>
                    ) : (
                      <MessageBubbleFile msg={msg} isOwn={isOwn} />
                    )}
                    <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
                      <span className="text-[10px] text-muted-foreground">{formatTime(new Date(msg.created_at))}</span>
                      {isOwn && (
                        <span className={cn('text-[10px]', msg.status === 'read' ? 'text-primary' : 'text-muted-foreground')}>
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                      {isOwn && msg.status === 'read' && (
                        <span className="text-[9px] text-primary/70 ml-0.5">Đã xem</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {previewFile && (
        <div className="px-4 py-2 border-t border-border bg-tg-sidebar">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary">
            {isImageType(previewFile.file.type) ? (
              <img src={previewFile.url} alt="preview" className="h-16 w-16 object-cover rounded-lg" />
            ) : isVideoType(previewFile.file.type) ? (
              <div className="h-16 w-16 rounded-lg bg-background/50 flex items-center justify-center">
                <Film className="h-6 w-6 text-primary" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg bg-background/50 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{previewFile.file.name}</p>
              <p className="text-xs text-muted-foreground">{(previewFile.file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={cancelPreview} className="p-1.5 rounded-full hover:bg-background/50 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-tg-sidebar">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0"
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={previewFile ? "Thêm chú thích..." : "Nhập tin nhắn..."}
              rows={1}
              className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/30 transition-all max-h-32"
              style={{ minHeight: '40px' }}
            />
          </div>
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0"><Smile className="h-5 w-5 text-muted-foreground" /></button>
          {input.trim() || previewFile ? (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={handleSend}
              disabled={uploading}
              className="p-2.5 rounded-full bg-primary hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {uploading ? (
                <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-primary-foreground" />
              )}
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
