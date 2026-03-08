import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Smile, Paperclip, Mic, MoreVertical, Phone, Video, Search, Info, X, FileText, Film, Image as ImageIcon, Reply, Trash2, RotateCcw, Eye, ImageIcon as GalleryIcon, ArrowLeft } from 'lucide-react';
import type { CallType } from '@/hooks/useWebRTC';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatTime, formatLastSeen } from '@/lib/chatUtils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ProfileViewDialog from './ProfileViewDialog';
import MediaGalleryDialog from './MediaGalleryDialog';
import InlineResultsDropdown from './InlineResultsDropdown';
import MiniAppDialog from './MiniAppDialog';
import ImageLightbox from './ImageLightbox';
import logoImg from '@/assets/logo.png';

const isImageType = (type: string) => type.startsWith('image/');
const isVideoType = (type: string) => type.startsWith('video/');

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

const MessageBubbleFile: React.FC<{ msg: any; isOwn: boolean; onImageClick?: (url: string) => void }> = ({ msg, isOwn, onImageClick }) => {
  const fileUrl = msg.file_url;
  const fileName = msg.file_name || 'file';
  const fileSize = msg.file_size;
  const msgType = msg.message_type;

  if (msgType === 'image' && fileUrl) {
    return (
      <div className="max-w-xs">
        <img src={fileUrl} alt={fileName} className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer" onClick={() => onImageClick?.(fileUrl)} />
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

const renderContent = (content: string | null) => {
  if (!content) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all">{part}</a>;
    }
    return part;
  });
};

interface MessageAreaProps {
  onStartCall?: (type: CallType) => void;
}

const MessageArea: React.FC<MessageAreaProps> = ({ onStartCall }) => {
  const { activeConversation, messages, sendMessage, toggleInfoPanel, profiles, loadingMessages, deleteConversation, leaveGroup, setMobileShowingChat, isBotFatherConversation, activeConversationId } = useChatContext();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ file: File; url: string } | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: any; x: number; y: number } | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [botCommands, setBotCommands] = useState<{ command: string; description: string }[]>([]);
  const [inlineResults, setInlineResults] = useState<any[]>([]);
  const [inlineBotUsername, setInlineBotUsername] = useState('');
  const [showInlineResults, setShowInlineResults] = useState(false);
  const [miniApp, setMiniApp] = useState<{ url: string; botName: string; botId?: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const inlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLenRef = useRef(0);

  // Fetch bot commands for the active conversation
  const isBotFather = isBotFatherConversation(activeConversation?.id || null);

  useEffect(() => {
    if (!activeConversation) { setBotCommands([]); return; }
    
    // BotFather has its own hardcoded commands
    if (isBotFather) {
      setBotCommands([
        { command: '/start', description: 'Start interacting with BotFather' },
        { command: '/help', description: 'Show all commands' },
        { command: '/newbot', description: 'Create a new bot' },
        { command: '/mybots', description: 'List your bots' },
        { command: '/setname', description: 'Change bot name' },
        { command: '/setdescription', description: 'Change bot description' },
        { command: '/setabouttext', description: 'Set bot about text' },
        { command: '/setcommands', description: 'Set bot commands' },
        { command: '/setwebhook', description: 'Configure webhook URL' },
        { command: '/setprivacy', description: 'Set privacy mode' },
        { command: '/revoke', description: 'Reset bot token' },
        { command: '/deletebot', description: 'Delete a bot' },
        { command: '/cancel', description: 'Cancel current operation' },
      ]);
      return;
    }

    const fetchBotCommands = async () => {
      const botMembers = activeConversation.members.filter(m => profiles[m.user_id]?.is_bot);
      if (botMembers.length === 0) { setBotCommands([]); return; }
      const { data: bots } = await supabase.from('bots').select('id, profile_id').in('profile_id', botMembers.map(m => m.user_id));
      if (!bots || bots.length === 0) { setBotCommands([]); return; }
      const { data: cmds } = await supabase.from('bot_commands').select('command, description').in('bot_id', bots.map(b => b.id));
      setBotCommands((cmds || []).map(c => ({ command: c.command, description: c.description || '' })));
    };
    fetchBotCommands();
  }, [activeConversation, profiles, isBotFather]);

  // Show command suggestions when typing "/"
  useEffect(() => {
    if (input.startsWith('/') && botCommands.length > 0) {
      setShowCommandSuggestions(true);
      setShowInlineResults(false);
    } else {
      setShowCommandSuggestions(false);
    }
  }, [input, botCommands]);

  // Inline query detection: @botname query
  useEffect(() => {
    const match = input.match(/^@(\w+)\s*(.*)/);
    if (!match) {
      setShowInlineResults(false);
      setInlineResults([]);
      return;
    }

    const botUsername = match[1];
    const query = match[2] || '';
    setInlineBotUsername(botUsername);

    // Debounce the inline query
    if (inlineDebounceRef.current) clearTimeout(inlineDebounceRef.current);
    inlineDebounceRef.current = setTimeout(async () => {
      try {
        // Find bot by username
        const { data: botProfile } = await supabase.from('profiles')
          .select('id').eq('username', botUsername).eq('is_bot', true).maybeSingle();
        if (!botProfile) { setInlineResults([]); setShowInlineResults(false); return; }

        // Use clientInlineQuery - no bot_token needed
        const { data } = await supabase.functions.invoke('bot-api', {
          body: {
            action: 'clientInlineQuery',
            bot_profile_id: botProfile.id,
            query,
            user_id: user?.id,
            chat_id: activeConversation?.id,
          },
        });

        if (data?.results && data.results.length > 0) {
          setInlineResults(data.results);
          setShowInlineResults(true);
        } else {
          setInlineResults([]);
          setShowInlineResults(false);
        }
      } catch (err) {
        console.error('Inline query error:', err);
        setInlineResults([]);
        setShowInlineResults(false);
      }
    }, 400);

    return () => {
      if (inlineDebounceRef.current) clearTimeout(inlineDebounceRef.current);
    };
  }, [input, user, activeConversation]);

  // Handle inline result selection
  const handleSelectInlineResult = useCallback(async (result: any) => {
    if (!activeConversation || !user) return;
    
    const content = result.content || result.title;
    const msgInsert: Record<string, any> = {
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content,
      message_type: result.reply_markup ? 'bot_message' : 'text',
    };
    if (result.reply_markup) {
      msgInsert.file_name = JSON.stringify(result.reply_markup);
    }
    if (result.thumbnail_url && (result.result_type === 'photo' || result.result_type === 'gif')) {
      msgInsert.message_type = 'image';
      msgInsert.file_url = result.thumbnail_url;
      msgInsert.file_name = result.title || 'inline_result';
    }

    await supabase.from('messages').insert(msgInsert as any);
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversation.id);
    
    setInput('');
    setShowInlineResults(false);
    setInlineResults([]);
  }, [activeConversation, user]);

  useEffect(() => {
    // Only scroll to bottom when messages are loaded (not on reset to empty)
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > prevMessagesLenRef.current && prevMessagesLenRef.current > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== user?.id) {
        playNotificationSound();
      }
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length, user?.id]);

  useEffect(() => {
    if (!activeConversation || !user || messages.length === 0) return;
    const unreadFromOthers = messages.filter(m => m.sender_id !== user.id && m.status !== 'read');
    if (unreadFromOthers.length > 0) {
      supabase.from('messages').update({ status: 'read' }).in('id', unreadFromOthers.map(m => m.id)).then();
    }
  }, [messages, activeConversation, user]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('File quá lớn. Tối đa 20MB.'); return; }
    setPreviewFile({ file, url: URL.createObjectURL(file) });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const cancelPreview = useCallback(() => {
    if (previewFile) { URL.revokeObjectURL(previewFile.url); setPreviewFile(null); }
  }, [previewFile]);

  const uploadAndSend = useCallback(async () => {
    if (!previewFile || !user || !activeConversation) return;
    setUploading(true);
    try {
      const file = previewFile.file;
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-files').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path);
      let messageType = 'file';
      if (isImageType(file.type)) messageType = 'image';
      else if (isVideoType(file.type)) messageType = 'video';
      await supabase.from('messages').insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content: input.trim() || null,
        message_type: messageType,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        reply_to: replyTo?.id || null,
      });
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversation.id);
      setInput('');
      setReplyTo(null);
      cancelPreview();
    } catch (err: any) {
      toast.error('Lỗi upload: ' + (err.message || 'Unknown'));
    } finally {
      setUploading(false);
    }
  }, [previewFile, user, activeConversation, input, cancelPreview, replyTo]);

  const handleSend = async () => {
    if (previewFile) { await uploadAndSend(); return; }
    if (!input.trim() || !activeConversation || !user) return;
    const text = input;
    setInput('');
    const reply = replyTo?.id || null;
    setReplyTo(null);
    await supabase.from('messages').insert({
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: text.trim(),
      message_type: 'text',
      reply_to: reply,
    });
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversation.id);

    // If this is a BotFather conversation, process the message
    if (isBotFatherConversation(activeConversation.id)) {
      try {
        await supabase.functions.invoke('botfather', {
          body: {
            action: 'process-message',
            message: text.trim(),
            conversation_id: activeConversation.id,
          },
        });
      } catch (err) {
        console.error('BotFather error:', err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleDeleteForMe = async (msgId: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const currentDeletedFor = (msg.deleted_for as string[]) || [];
    await supabase.from('messages').update({ deleted_for: [...currentDeletedFor, user.id] }).eq('id', msgId);
    toast.success('Đã xoá ở phía bạn');
    setContextMenu(null);
  };

  const handleRecall = async (msgId: string) => {
    await supabase.from('messages').update({ deleted: true, content: null, file_url: null }).eq('id', msgId);
    toast.success('Đã thu hồi tin nhắn');
    setContextMenu(null);
  };

  const handleDeleteConversation = async () => {
    if (!activeConversation) return;
    if (window.confirm('Xoá cuộc trò chuyện này?')) {
      await deleteConversation(activeConversation.id);
    }
    setHeaderMenu(false);
  };

  const handleLeaveGroup = async () => {
    if (!activeConversation) return;
    if (window.confirm('Rời khỏi nhóm này?')) {
      await leaveGroup(activeConversation.id);
    }
    setHeaderMenu(false);
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-tg-chat">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <img src={logoImg} alt="Chim Cu Gáy" className="w-16 h-16 mx-auto mb-6 drop-shadow-lg rounded-full" />
          <h2 className="text-xl font-display font-semibold mb-2">Chim Cu Gáy</h2>
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

  const handleAvatarClick = () => {
    if (activeConversation.type === 'private' && user) {
      const other = activeConversation.members.find(m => m.user_id !== user.id);
      if (other) setViewProfileId(other.user_id);
    }
  };

  // Find replied message
  const getReplyMsg = (replyId: string | null) => {
    if (!replyId) return null;
    return messages.find(m => m.id === replyId) || null;
  };

  // Filter visible messages (not deleted_for me, not recalled)
  const visibleMessages = messages.filter(m => {
    if (m.deleted && m.sender_id !== user?.id) return true; // show "recalled" placeholder
    if (m.deleted_for && user && (m.deleted_for as string[]).includes(user.id)) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-tg-chat h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-tg-sidebar">
        <button onClick={() => setMobileShowingChat(false)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors md:hidden flex-shrink-0">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="cursor-pointer flex-shrink-0" onClick={handleAvatarClick}>
          <ChatAvatar name={getConvName()} online={getOtherOnline()} size="sm" isBot={(() => {
            if (activeConversation.type === 'private' && user) {
              const other = activeConversation.members.find(m => m.user_id !== user.id);
              return other ? !!profiles[other.user_id]?.is_bot : false;
            }
            return false;
          })()}/>
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={toggleInfoPanel}>
          <h3 className="font-semibold text-sm truncate flex items-center gap-1.5">
            {getConvName()}
            {activeConversation.type === 'private' && user && (() => {
              const other = activeConversation.members.find(m => m.user_id !== user.id);
              return other && profiles[other.user_id]?.is_bot ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">BOT</span>
              ) : null;
            })()}
          </h3>
          <p className={cn('text-xs', getOtherOnline() ? 'text-tg-online' : 'text-muted-foreground')}>{getStatusText()}</p>
        </div>
        <span className="text-[10px] font-display font-semibold text-muted-foreground/60 tracking-wider uppercase mr-1 hidden sm:inline">Chim Cu Gáy</span>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Search className="h-4 w-4 text-muted-foreground" /></button>
          {activeConversation.type === 'private' && onStartCall && (
            <>
              <button onClick={() => onStartCall('voice')} className="p-2 rounded-lg hover:bg-tg-hover transition-colors" title="Gọi thoại"><Phone className="h-4 w-4 text-muted-foreground" /></button>
              <button onClick={() => onStartCall('video')} className="p-2 rounded-lg hover:bg-tg-hover transition-colors" title="Gọi video"><Video className="h-4 w-4 text-muted-foreground" /></button>
            </>
          )}
          {activeConversation.type !== 'private' && (
            <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Phone className="h-4 w-4 text-muted-foreground" /></button>
          )}
          <button onClick={toggleInfoPanel} className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><Info className="h-4 w-4 text-muted-foreground" /></button>
          <div className="relative">
            <button onClick={() => setHeaderMenu(p => !p)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {headerMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHeaderMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute top-full right-0 mt-1 w-56 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    <button onClick={() => { setShowMediaGallery(true); setHeaderMenu(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      <span>Ảnh & File đã gửi</span>
                    </button>
                    {activeConversation.type !== 'private' && (
                      <button onClick={handleLeaveGroup} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                        <X className="h-4 w-4 text-muted-foreground" />
                        <span>Rời nhóm</span>
                      </button>
                    )}
                    <div className="border-t border-border" />
                    <button onClick={handleDeleteConversation} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left text-destructive">
                      <Trash2 className="h-4 w-4" />
                      <span>Xoá cuộc trò chuyện</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visibleMessages.map((msg, i) => {
              const isOwn = msg.sender_id === user?.id;
              const showAvatar = !isOwn && (i === 0 || visibleMessages[i - 1].sender_id !== msg.sender_id);
              const sender = profiles[msg.sender_id];
              const repliedMsg = getReplyMsg(msg.reply_to);

              // Recalled message
              if (msg.deleted) {
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
                    {!isOwn && <div className="w-8 flex-shrink-0" />}
                    <div className="max-w-[70%] px-3 py-2 rounded-2xl text-sm bg-muted/50 italic text-muted-foreground">
                      🚫 Tin nhắn đã được thu hồi
                    </div>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}
                >
                  {!isOwn && (
                    <div className="w-8 flex-shrink-0 cursor-pointer" onClick={() => setViewProfileId(msg.sender_id)}>
                      {showAvatar && sender && <ChatAvatar name={sender.display_name} size="sm" />}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[70%] px-3 py-2 rounded-2xl text-sm relative group',
                      isOwn ? 'bg-tg-message-out rounded-br-md' : 'bg-tg-message-in rounded-bl-md'
                    )}
                    style={{ boxShadow: 'var(--tg-bubble-shadow)' }}
                    onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                  >
                    {!isOwn && activeConversation.type !== 'private' && showAvatar && (
                      <p className="text-xs font-medium text-primary mb-0.5 cursor-pointer" onClick={() => setViewProfileId(msg.sender_id)}>
                        {sender?.display_name}
                        {sender?.is_bot && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase">BOT</span>}
                      </p>
                    )}
                    {!isOwn && activeConversation.type === 'private' && sender?.is_bot && (
                      <p className="text-[9px] font-bold text-primary/60 mb-0.5 uppercase tracking-wider">BOT</p>
                    )}
                    {/* Reply preview */}
                    {repliedMsg && (
                      <div className="mb-1 px-2 py-1 rounded-lg bg-background/30 border-l-2 border-primary text-xs">
                        <p className="font-medium text-primary truncate">{profiles[repliedMsg.sender_id]?.display_name || 'Unknown'}</p>
                        <p className="truncate text-muted-foreground">{repliedMsg.content || '📎 File'}</p>
                      </div>
                    )}
                    {msg.message_type === 'text' ? (
                      <p className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</p>
                    ) : msg.message_type === 'bot_message' ? (
                      <div>
                        <p className="whitespace-pre-wrap break-words">{renderContent(msg.content)}</p>
                        {msg.file_name && (() => {
                          try {
                            const markup = JSON.parse(msg.file_name);
                            if (markup?.inline_keyboard) {
                              return (
                                <div className="mt-2 space-y-1">
                                  {markup.inline_keyboard.map((row: any[], ri: number) => (
                                    <div key={ri} className="flex gap-1">
                                      {row.map((btn: any, bi: number) => (
                                        btn.url ? (
                                          <a key={bi} href={btn.url} target="_blank" rel="noopener noreferrer"
                                            className="flex-1 text-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                                            {btn.text}
                                          </a>
                                        ) : btn.web_app?.url ? (
                                          <button key={bi} onClick={() => {
                                            const senderProfile = profiles[msg.sender_id];
                                            setMiniApp({
                                              url: btn.web_app.url,
                                              botName: senderProfile?.display_name || 'Mini App',
                                              botId: msg.sender_id,
                                            });
                                          }} className="flex-1 text-center px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors border border-primary/20">
                                            ▶ {btn.text}
                                          </button>
                                        ) : (
                                          <button key={bi} onClick={async () => {
                                            if (btn.callback_data) {
                                              await supabase.from('messages').insert({
                                                conversation_id: activeConversation!.id,
                                                sender_id: user!.id,
                                                content: btn.callback_data,
                                                message_type: 'text',
                                              });
                                              await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversation!.id);
                                              if (isBotFatherConversation(activeConversation!.id)) {
                                                try {
                                                  await supabase.functions.invoke('botfather', {
                                                    body: {
                                                      action: 'process-message',
                                                      message: btn.callback_data,
                                                      conversation_id: activeConversation!.id,
                                                    },
                                                  });
                                                } catch (err) {
                                                  console.error('BotFather callback error:', err);
                                                }
                                              }
                                            }
                                          }} className="flex-1 text-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                                            {btn.text}
                                          </button>
                                        )
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                          } catch {}
                          return null;
                        })()}
                      </div>
                    ) : (
                      <MessageBubbleFile msg={msg} isOwn={isOwn} onImageClick={(url) => setLightboxImage(url)} />
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
                    {/* Hover action buttons */}
                    <div className={cn('absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5', isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1')}>
                      <button onClick={() => setReplyTo(msg)} className="p-1 rounded bg-secondary hover:bg-tg-hover" title="Trả lời">
                        <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Context menu for messages */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
              <Reply className="h-4 w-4 text-muted-foreground" /> Trả lời
            </button>
            <button onClick={() => handleDeleteForMe(contextMenu.msg.id)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
              <Trash2 className="h-4 w-4 text-muted-foreground" /> Xoá ở phía bạn
            </button>
            {contextMenu.msg.sender_id === user?.id && (
              <button onClick={() => handleRecall(contextMenu.msg.id)} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left text-destructive">
                <RotateCcw className="h-4 w-4" /> Thu hồi
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-border bg-tg-sidebar">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary">
            <div className="border-l-2 border-primary pl-2 flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">{profiles[replyTo.sender_id]?.display_name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content || '📎 File'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-background/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* File Preview */}
      {previewFile && (
        <div className="px-4 py-2 border-t border-border bg-tg-sidebar">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary">
            {isImageType(previewFile.file.type) ? (
              <img src={previewFile.url} alt="preview" className="h-16 w-16 object-cover rounded-lg" />
            ) : isVideoType(previewFile.file.type) ? (
              <div className="h-16 w-16 rounded-lg bg-background/50 flex items-center justify-center"><Film className="h-6 w-6 text-primary" /></div>
            ) : (
              <div className="h-16 w-16 rounded-lg bg-background/50 flex items-center justify-center"><FileText className="h-6 w-6 text-primary" /></div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{previewFile.file.name}</p>
              <p className="text-xs text-muted-foreground">{(previewFile.file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={cancelPreview} className="p-1.5 rounded-full hover:bg-background/50 transition-colors"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" className="hidden" onChange={handleFileSelect} />

      {/* Inline results dropdown */}
      {showInlineResults && (
        <InlineResultsDropdown
          results={inlineResults}
          botUsername={inlineBotUsername}
          onSelectResult={handleSelectInlineResult}
          onClose={() => { setShowInlineResults(false); setInlineResults([]); }}
        />
      )}

      {/* Command suggestions */}
      <AnimatePresence>
        {showCommandSuggestions && !showInlineResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-2 border-t border-border bg-tg-sidebar"
          >
            <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden max-h-40 overflow-y-auto">
              {botCommands
                .filter(c => c.command.startsWith(input) || input === '/')
                .map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(cmd.command + ' '); setShowCommandSuggestions(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left"
                  >
                    <code className="text-primary font-mono font-semibold text-xs">{cmd.command}</code>
                    <span className="text-muted-foreground text-xs truncate">{cmd.description}</span>
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-tg-sidebar">
        <div className="flex items-end gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={previewFile ? "Thêm chú thích..." : "Nhập tin nhắn hoặc @botname query..."}
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
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onClick={handleSend}
              disabled={uploading}
              className="p-2.5 rounded-full bg-primary hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {uploading ? <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Send className="h-4 w-4 text-primary-foreground" />}
            </motion.button>
          ) : (
            <button className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0"><Mic className="h-5 w-5 text-muted-foreground" /></button>
          )}
        </div>
      </div>

      {viewProfileId && <ProfileViewDialog userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
      {showMediaGallery && <MediaGalleryDialog onClose={() => setShowMediaGallery(false)} />}
      {miniApp && (
        <MiniAppDialog
          url={miniApp.url}
          botName={miniApp.botName}
          chatId={activeConversation?.id}
          botId={miniApp.botId}
          onClose={() => setMiniApp(null)}
        />
      )}
    </div>
  );
};

export default MessageArea;
