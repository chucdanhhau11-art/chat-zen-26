import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Smile, Paperclip, Mic, MicOff, MoreVertical, Phone, Video, Search, Info, X, FileText, Film, Image as ImageIcon, Reply, Trash2, RotateCcw, Eye, ImageIcon as GalleryIcon, ArrowLeft, ChevronDown, ChevronUp, Plus, Play, Pause, Square } from 'lucide-react';
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
import TransferOwnerDialog from './TransferOwnerDialog';
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

// Voice message player component
const VoiceMessagePlayer: React.FC<{ url: string; duration?: number }> = ({ url, duration }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) setTotalDuration(audio.duration);
    });
    audio.addEventListener('ended', () => { setPlaying(false); setCurrentTime(0); });
    return () => { audio.pause(); audio.src = ''; cancelAnimationFrame(animFrameRef.current); };
  }, [url]);

  const tick = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!audioRef.current.paused) animFrameRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); animFrameRef.current = requestAnimationFrame(tick); }
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const formatDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Generate waveform bars
  const bars = 24;
  const waveform = useMemo(() => Array.from({ length: bars }, (_, i) => {
    const seed = (i * 7 + 3) % 10;
    return 0.2 + (seed / 10) * 0.8;
  }), []);

  return (
    <div className="flex items-center gap-2 min-w-[200px] max-w-[280px]">
      <button onClick={togglePlay} className="p-1.5 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors flex-shrink-0">
        {playing ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-primary ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-6">
          {waveform.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-150"
              style={{
                height: `${h * 100}%`,
                backgroundColor: i / bars * 100 < progress ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{formatDur(playing ? currentTime : totalDuration)}</span>
      </div>
    </div>
  );
};

const MessageBubbleFile: React.FC<{ msg: any; isOwn: boolean; onImageClick?: (url: string) => void }> = ({ msg, isOwn, onImageClick }) => {
  const fileUrl = msg.file_url;
  const fileName = msg.file_name || 'file';
  const fileSize = msg.file_size;
  const msgType = msg.message_type;

  if (msgType === 'voice' && fileUrl) {
    return (
      <div>
        <VoiceMessagePlayer url={fileUrl} />
        {msg.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
      </div>
    );
  }
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

const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-400/70 dark:bg-yellow-500/50 text-foreground rounded-sm px-0.5">{part}</mark>
    ) : part
  );
};

const renderContent = (content: string | null, searchQuery?: string) => {
  if (!content) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 break-all">{searchQuery ? highlightText(part, searchQuery) : part}</a>;
    }
    return searchQuery ? <React.Fragment key={i}>{highlightText(part, searchQuery)}</React.Fragment> : part;
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
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [reactions, setReactions] = useState<Record<string, { emoji: string; user_id: string; id: string }[]>>({});
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const inputEmojiRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingCancelled, setRecordingCancelled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingCancelledRef = useRef(false);
  const prevMessagesLenRef = useRef(0);

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

  // Fetch bot commands for the active conversation
  const isBotFather = isBotFatherConversation(activeConversation?.id || null);

  useEffect(() => {
    if (!activeConversation) { setBotCommands([]); return; }
    
    // BotFather has its own hardcoded commands
    if (isBotFather) {
      setBotCommands([
        { command: '/start', description: 'Bắt đầu / Start' },
        { command: '/help', description: 'Hiện tất cả lệnh / Show all commands' },
        { command: '/newbot', description: 'Tạo bot mới / Create a new bot' },
        { command: '/mybots', description: 'Danh sách bot / List your bots' },
        { command: '/setname', description: 'Đổi tên bot / Rename bot' },
        { command: '/setdescription', description: 'Đổi mô tả / Change description' },
        { command: '/setabouttext', description: 'Đặt giới thiệu / Set about text' },
        { command: '/setcommands', description: 'Đặt lệnh / Set commands' },
        { command: '/setwebhook', description: 'Cấu hình webhook / Configure webhook' },
        { command: '/setprivacy', description: 'Chế độ riêng tư / Privacy mode' },
        { command: '/revoke', description: 'Đặt lại token / Reset token' },
        { command: '/deletebot', description: 'Xoá bot / Delete bot' },
        { command: '/cancel', description: 'Huỷ thao tác / Cancel operation' },
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

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom('smooth');
  }, [messages.length, scrollToBottom]);

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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { toast.error('File quá lớn. Tối đa 20MB.'); return; }
        setPreviewFile({ file, url: URL.createObjectURL(file) });
        return;
      }
    }
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

  // Voice recording functions
  const startRecording = useCallback(async () => {
    if (!activeConversation || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      setRecordingCancelled(false);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        recordingStreamRef.current = null;
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }

        if (recordingCancelledRef.current || audioChunksRef.current.length === 0) {
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 500) { setIsRecording(false); setRecordingTime(0); return; }

        // Upload voice
        setUploading(true);
        try {
          const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
          const path = `${user.id}/voice_${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('chat-files').upload(path, blob, { contentType: mimeType });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path);
          await supabase.from('messages').insert({
            conversation_id: activeConversation.id,
            sender_id: user.id,
            content: null,
            message_type: 'voice',
            file_url: urlData.publicUrl,
            file_name: `voice_${Date.now()}.${ext}`,
            file_size: blob.size,
            reply_to: replyTo?.id || null,
          });
          await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversation.id);
          setReplyTo(null);
        } catch (err: any) {
          toast.error('Lỗi gửi ghi âm: ' + (err.message || 'Unknown'));
        } finally {
          setUploading(false);
        }

        setIsRecording(false);
        setRecordingTime(0);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err: any) {
      toast.error('Không thể truy cập microphone');
    }
  }, [activeConversation, user, replyTo]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      recordingCancelledRef.current = false;
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    setRecordingCancelled(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(t => t.stop());
      recordingStreamRef.current = null;
    }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingStreamRef.current) recordingStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatRecordingTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

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

  // Determine ownership status for leave handling
  const isOwner = user && activeConversation?.members.find(m => m.user_id === user.id)?.role === 'owner';
  const otherMembers = (activeConversation?.members || []).filter(m => m.user_id !== user?.id).map(m => ({
    ...m,
    profile: profiles[m.user_id] || null,
  }));

  const handleLeaveGroup = async () => {
    if (!activeConversation) return;
    
    // If owner and there are other members, show transfer dialog
    if (isOwner && otherMembers.length > 0) {
      setShowTransferDialog(true);
      setHeaderMenu(false);
      return;
    }
    
    // If owner but no other members, or if not owner, just leave
    if (window.confirm('Rời khỏi nhóm này?')) {
      await leaveGroup(activeConversation.id);
    }
    setHeaderMenu(false);
  };

  const handleTransferAndLeave = async (newOwnerId: string) => {
    if (!activeConversation) return;
    await leaveGroup(activeConversation.id, newOwnerId);
  };

  const contextMenuRef = useRef<HTMLDivElement>(null);

  const handleMessageContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    // Estimate menu size for boundary clamping
    const menuW = 200, menuH = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setContextMenu({ msg, x: Math.max(8, x), y: Math.max(8, y) });
  };

  // Filter visible messages (not deleted_for me, not recalled)
  const visibleMessages = messages.filter(m => {
    if (m.deleted && m.sender_id !== user?.id) return true;
    if (m.deleted_for && user && (m.deleted_for as string[]).includes(user.id)) return false;
    return true;
  });

  // Message search logic
  useEffect(() => {
    if (!msgSearchQuery.trim()) { setSearchMatchIds([]); setSearchActiveIdx(0); return; }
    const q = msgSearchQuery.toLowerCase();
    const ids = visibleMessages.filter(m => m.content?.toLowerCase().includes(q)).map(m => m.id);
    setSearchMatchIds(ids);
    setSearchActiveIdx(ids.length > 0 ? ids.length - 1 : 0);
  }, [msgSearchQuery, messages]);

  useEffect(() => {
    if (searchMatchIds.length > 0 && searchMatchIds[searchActiveIdx]) {
      document.getElementById(`msg-${searchMatchIds[searchActiveIdx]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchActiveIdx, searchMatchIds]);

  const toggleSearch = useCallback(() => {
    setShowSearch(prev => {
      if (!prev) setTimeout(() => searchInputRef.current?.focus(), 100);
      else { setMsgSearchQuery(''); setSearchMatchIds([]); }
      return !prev;
    });
  }, []);

  // Fetch reactions for current conversation messages
  useEffect(() => {
    if (!activeConversation || visibleMessages.length === 0) { setReactions({}); return; }
    const msgIds = visibleMessages.map(m => m.id);
    const fetchReactions = async () => {
      const { data } = await supabase.from('reactions').select('*').in('message_id', msgIds);
      if (data) {
        const grouped: Record<string, { emoji: string; user_id: string; id: string }[]> = {};
        data.forEach(r => {
          if (!grouped[r.message_id]) grouped[r.message_id] = [];
          grouped[r.message_id].push({ emoji: r.emoji, user_id: r.user_id, id: r.id });
        });
        setReactions(grouped);
      }
    };
    fetchReactions();
  }, [activeConversation?.id, messages.length]);

  // Realtime reactions
  useEffect(() => {
    if (!activeConversation) return;
    const channel = supabase.channel(`reactions-${activeConversation.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new;
          setReactions(prev => {
            const existing = prev[r.message_id] || [];
            // Skip if already exists (from optimistic update) - match by real id or by temp + same user/emoji
            if (existing.some(x => x.id === r.id || (x.id.startsWith('temp-') && x.user_id === r.user_id && x.emoji === r.emoji))) {
              // Replace temp id with real id
              return { ...prev, [r.message_id]: existing.map(x => x.id.startsWith('temp-') && x.user_id === r.user_id && x.emoji === r.emoji ? { ...x, id: r.id } : x) };
            }
            return { ...prev, [r.message_id]: [...existing, { emoji: r.emoji, user_id: r.user_id, id: r.id }] };
          });
        } else if (payload.eventType === 'DELETE') {
          const r = payload.old;
          setReactions(prev => ({
            ...prev,
            [r.message_id]: (prev[r.message_id] || []).filter(x => x.id !== r.id),
          }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation?.id]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions[messageId]?.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      // Optimistic remove
      setReactions(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(x => x.id !== existing.id),
      }));
      await supabase.from('reactions').delete().eq('id', existing.id);
    } else {
      // Optimistic add with temp id
      const tempId = `temp-${Date.now()}`;
      setReactions(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), { emoji, user_id: user.id, id: tempId }],
      }));
      const { data } = await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji }).select().single();
      if (data) {
        setReactions(prev => ({
          ...prev,
          [messageId]: (prev[messageId] || []).map(r => r.id === tempId ? { ...r, id: data.id } : r),
        }));
      }
    }
    setEmojiPickerMsgId(null);
  }, [user, reactions]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerMsgId) return;
    const handler = () => setEmojiPickerMsgId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [emojiPickerMsgId]);

  // Close input emoji picker on outside click
  useEffect(() => {
    if (!showInputEmoji) return;
    const handler = (e: MouseEvent) => {
      if (inputEmojiRef.current && !inputEmojiRef.current.contains(e.target as Node)) {
        setShowInputEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showInputEmoji]);

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
          <button onClick={toggleSearch} className={cn("p-2 rounded-lg hover:bg-tg-hover transition-colors", showSearch && "bg-tg-hover")}><Search className="h-4 w-4 text-muted-foreground" /></button>
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

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-tg-sidebar"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={searchInputRef}
                value={msgSearchQuery}
                onChange={e => setMsgSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchMatchIds.length > 0) {
                    setSearchActiveIdx(prev => (prev - 1 + searchMatchIds.length) % searchMatchIds.length);
                  } else if (e.key === 'Escape') {
                    toggleSearch();
                  }
                }}
                placeholder="Tìm tin nhắn..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
              {searchMatchIds.length > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {searchActiveIdx + 1}/{searchMatchIds.length}
                </span>
              )}
              {msgSearchQuery && searchMatchIds.length === 0 && (
                <span className="text-xs text-muted-foreground">Không tìm thấy</span>
              )}
              <button onClick={() => setSearchActiveIdx(prev => (prev - 1 + searchMatchIds.length) % searchMatchIds.length)} disabled={searchMatchIds.length === 0} className="p-1 rounded hover:bg-tg-hover disabled:opacity-30">
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={() => setSearchActiveIdx(prev => (prev + 1) % searchMatchIds.length)} disabled={searchMatchIds.length === 0} className="p-1 rounded hover:bg-tg-hover disabled:opacity-30">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              <button onClick={toggleSearch} className="p-1 rounded hover:bg-tg-hover">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="relative flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1">
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
                  <motion.div key={msg.id} id={`msg-${msg.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
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
                  id={`msg-${msg.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start', searchMatchIds.includes(msg.id) && 'bg-primary/10 rounded-lg -mx-1 px-1')}
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
                      <p className="whitespace-pre-wrap break-words">{renderContent(msg.content, msgSearchQuery)}</p>
                    ) : msg.message_type === 'bot_message' ? (
                      <div>
                        <p className="whitespace-pre-wrap break-words">{renderContent(msg.content, msgSearchQuery)}</p>
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
                    {/* Reactions display */}
                    {reactions[msg.id] && reactions[msg.id].length > 0 && (() => {
                      const grouped: Record<string, string[]> = {};
                      reactions[msg.id].forEach(r => {
                        if (!grouped[r.emoji]) grouped[r.emoji] = [];
                        grouped[r.emoji].push(r.user_id);
                      });
                      return (
                        <motion.div layout className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(grouped).map(([emoji, userIds]) => {
                            const isMine = userIds.includes(user?.id || '');
                            return (
                              <motion.button
                                key={emoji}
                                layout
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                whileTap={{ scale: 0.85 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={cn(
                                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors duration-200',
                                  isMine ? 'bg-primary/15 border-primary/40 shadow-sm' : 'bg-secondary/80 border-transparent hover:bg-muted'
                                )}
                                title={isMine ? 'Nhấn để thu hồi' : 'Nhấn để thả'}
                              >
                                <motion.span
                                  key={`${emoji}-${userIds.length}`}
                                  initial={{ scale: 1.4 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                  {emoji}
                                </motion.span>
                                <span className="text-[10px] text-muted-foreground font-medium">{userIds.length}</span>
                              </motion.button>
                            );
                          })}
                          <motion.button
                            layout
                            whileTap={{ scale: 0.85 }}
                            onClick={(e) => { e.stopPropagation(); setEmojiPickerMsgId(prev => prev === msg.id ? null : msg.id); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary/60 hover:bg-muted border border-transparent transition-colors duration-200"
                            title="Thêm cảm xúc"
                          >
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          </motion.button>
                        </motion.div>
                      );
                    })()}
                    {/* Hover action buttons */}
                    <div className={cn('absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-0.5', isOwn ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1')}>
                      <button onClick={() => setReplyTo(msg)} className="p-1 rounded-lg bg-secondary/90 hover:bg-tg-hover backdrop-blur-sm transition-colors duration-150" title="Trả lời">
                        <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEmojiPickerMsgId(prev => prev === msg.id ? null : msg.id); }} className="p-1 rounded-lg bg-secondary/90 hover:bg-tg-hover backdrop-blur-sm transition-colors duration-150" title="Thả cảm xúc">
                        <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {/* Emoji picker */}
                    <AnimatePresence>
                      {emojiPickerMsgId === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 8 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          onClick={e => e.stopPropagation()}
                          className={cn('absolute z-50 bg-popover/95 backdrop-blur-md border border-border rounded-2xl shadow-xl p-2 flex gap-0.5', isOwn ? 'right-0 bottom-full mb-2' : 'left-0 bottom-full mb-2')}
                        >
                          {QUICK_EMOJIS.map((emoji, idx) => (
                            <motion.button
                              key={emoji}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: idx * 0.03, type: 'spring', stiffness: 500, damping: 20 }}
                              whileHover={{ scale: 1.3 }}
                              whileTap={{ scale: 0.85 }}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors duration-150 text-xl"
                            >
                              {emoji}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom('smooth')}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 ml-auto mr-auto w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors z-10"
              title="Về tin nhắn mới nhất"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>
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
            {contextMenu.msg.message_type === 'image' && contextMenu.msg.file_url && (
              <button onClick={async () => {
                try {
                  const res = await fetch(contextMenu.msg.file_url);
                  const blob = await res.blob();
                  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                  toast.success('Đã sao chép ảnh');
                } catch { toast.error('Không thể sao chép ảnh'); }
                setContextMenu(null);
              }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Sao chép ảnh
              </button>
            )}
            {contextMenu.msg.content && (
              <button onClick={() => {
                navigator.clipboard.writeText(contextMenu.msg.content || '');
                toast.success('Đã sao chép');
                setContextMenu(null);
              }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-tg-hover transition-colors text-left">
                <Eye className="h-4 w-4 text-muted-foreground" /> Sao chép text
              </button>
            )}
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
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3"
            >
              <motion.button
                onClick={cancelRecording}
                whileTap={{ scale: 0.9 }}
                className="p-2.5 rounded-full bg-destructive/10 hover:bg-destructive/20 transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5 text-destructive" />
              </motion.button>
              <div className="flex-1 flex items-center gap-3 bg-secondary rounded-xl px-4 py-2.5">
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="h-3 w-3 rounded-full bg-destructive flex-shrink-0"
                />
                <span className="text-sm font-medium text-foreground">{formatRecordingTime(recordingTime)}</span>
                <div className="flex-1 flex items-center gap-[2px] h-5">
                  {Array.from({ length: 30 }, (_, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-full bg-primary/40"
                      animate={{
                        height: ['20%', `${30 + Math.random() * 70}%`, '20%'],
                      }}
                      transition={{
                        duration: 0.4 + Math.random() * 0.4,
                        repeat: Infinity,
                        delay: i * 0.03,
                      }}
                      style={{ minHeight: 2 }}
                    />
                  ))}
                </div>
              </div>
              <motion.button
                onClick={stopRecording}
                whileTap={{ scale: 0.9 }}
                className="p-2.5 rounded-full bg-primary hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                {uploading ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-primary-foreground" />
                )}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2"
            >
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={previewFile ? "Thêm chú thích..." : "Nhập tin nhắn hoặc @botname query..."}
                  rows={1}
                  className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/30 transition-all max-h-32"
                  style={{ minHeight: '40px' }}
                />
              </div>
              <div className="relative flex-shrink-0" ref={inputEmojiRef}>
                <button onClick={() => setShowInputEmoji(prev => !prev)} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </button>
                <AnimatePresence>
                  {showInputEmoji && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-12 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg p-3 min-w-[220px]"
                    >
                      <div className="grid grid-cols-8 gap-1">
                        {['😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳','😢','😭','😤','😡','🤔','🤗','👍','👎','👏','🙏','❤️','🔥','💯','🎉','✨','💀','🤡','👀','🫡','🫶','💪','🤝'].map(em => (
                          <button
                            key={em}
                            onClick={() => { setInput(prev => prev + em); setShowInputEmoji(false); }}
                            className="text-xl hover:bg-secondary rounded-md p-1 transition-colors"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                <motion.button
                  onClick={startRecording}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-lg hover:bg-tg-hover transition-colors flex-shrink-0"
                >
                  <Mic className="h-5 w-5 text-muted-foreground" />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {viewProfileId && <ProfileViewDialog userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
      {showMediaGallery && <MediaGalleryDialog onClose={() => setShowMediaGallery(false)} />}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          allImages={messages.filter(m => m.message_type === 'image' && m.file_url).map(m => ({ src: m.file_url!, alt: m.file_name || '' }))}
          initialIndex={messages.filter(m => m.message_type === 'image' && m.file_url).findIndex(m => m.file_url === lightboxImage)}
          onClose={() => setLightboxImage(null)}
        />
      )}
      {miniApp && (
        <MiniAppDialog
          url={miniApp.url}
          botName={miniApp.botName}
          chatId={activeConversation?.id}
          botId={miniApp.botId}
          onClose={() => setMiniApp(null)}
        />
      )}
      {showTransferDialog && (
        <TransferOwnerDialog
          open={showTransferDialog}
          onClose={() => setShowTransferDialog(false)}
          members={otherMembers}
          onTransferAndLeave={handleTransferAndLeave}
        />
      )}
    </div>
  );
};

export default MessageArea;
