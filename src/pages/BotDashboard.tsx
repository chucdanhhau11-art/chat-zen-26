import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Plus, Trash2, RefreshCw, Copy, Eye, EyeOff, Settings, Globe, Zap, Terminal, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ChatAvatar from '@/components/chat/ChatAvatar';

interface BotData {
  id: string;
  profile_id: string;
  owner_id: string;
  bot_token: string;
  webhook_url: string | null;
  description: string | null;
  status: string;
  permissions: Record<string, boolean>;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
  };
}

const BotDashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotData[]>([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [tab, setTab] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);

  // Create form
  const [botName, setBotName] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [botDescription, setBotDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editWebhook, setEditWebhook] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [commands, setCommands] = useState<{ command: string; description: string }[]>([]);
  const [newCmd, setNewCmd] = useState('');
  const [newCmdDesc, setNewCmdDesc] = useState('');

  const fetchBots = useCallback(async () => {
    setLoadingBots(true);
    const { data, error } = await supabase.functions.invoke('bot-manage', {
      body: { action: 'list' },
    });
    if (data?.bots) setBots(data.bots);
    setLoadingBots(false);
  }, []);

  useEffect(() => {
    if (user) fetchBots();
  }, [user, fetchBots]);

  const handleCreate = async () => {
    if (!botName.trim() || !botUsername.trim()) {
      toast.error('Vui lòng nhập tên và username cho bot');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('bot-manage', {
        body: { action: 'create', bot_name: botName, username: botUsername, description: botDescription },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Tạo bot thành công!');
      setBotName(''); setBotUsername(''); setBotDescription('');
      setTab('list');
      fetchBots();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
    setCreating(false);
  };

  const handleSelectBot = async (bot: BotData) => {
    setSelectedBot(bot);
    setEditWebhook(bot.webhook_url || '');
    setEditDescription(bot.description || '');
    setEditName(bot.profiles?.display_name || '');
    setShowToken(false);
    // Fetch commands
    const { data } = await supabase.from('bot_commands').select('*').eq('bot_id', bot.id);
    setCommands((data || []).map(c => ({ command: c.command, description: c.description || '' })));
    setTab('detail');
  };

  const handleUpdate = async () => {
    if (!selectedBot) return;
    try {
      const { data, error } = await supabase.functions.invoke('bot-manage', {
        body: {
          action: 'update',
          bot_id: selectedBot.id,
          bot_name: editName,
          description: editDescription,
          webhook_url: editWebhook || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Đã cập nhật bot');
      fetchBots();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const handleResetToken = async () => {
    if (!selectedBot || !window.confirm('Reset token? Token cũ sẽ không còn hoạt động.')) return;
    try {
      const { data, error } = await supabase.functions.invoke('bot-manage', {
        body: { action: 'reset-token', bot_id: selectedBot.id },
      });
      if (error) throw error;
      if (data?.bot_token) {
        setSelectedBot({ ...selectedBot, bot_token: data.bot_token });
        toast.success('Token đã được reset');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const handleDelete = async () => {
    if (!selectedBot || !window.confirm('Xoá bot này? Hành động không thể hoàn tác.')) return;
    try {
      const { error } = await supabase.functions.invoke('bot-manage', {
        body: { action: 'delete', bot_id: selectedBot.id },
      });
      if (error) throw error;
      toast.success('Đã xoá bot');
      setTab('list');
      setSelectedBot(null);
      fetchBots();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedBot) return;
    const newStatus = selectedBot.status === 'active' ? 'disabled' : 'active';
    try {
      const { error } = await supabase.functions.invoke('bot-manage', {
        body: { action: 'update', bot_id: selectedBot.id, status: newStatus },
      });
      if (error) throw error;
      setSelectedBot({ ...selectedBot, status: newStatus });
      toast.success(newStatus === 'active' ? 'Bot đã được kích hoạt' : 'Bot đã bị vô hiệu hóa');
      fetchBots();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const handleSaveCommands = async () => {
    if (!selectedBot) return;
    try {
      const { error } = await supabase.functions.invoke('bot-manage', {
        body: { action: 'set-commands', bot_id: selectedBot.id, commands },
      });
      if (error) throw error;
      toast.success('Đã lưu commands');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const addCommand = () => {
    if (!newCmd.trim()) return;
    const cmd = newCmd.startsWith('/') ? newCmd : `/${newCmd}`;
    if (commands.some(c => c.command === cmd)) { toast.error('Command đã tồn tại'); return; }
    setCommands([...commands, { command: cmd, description: newCmdDesc }]);
    setNewCmd(''); setNewCmdDesc('');
  };

  const removeCommand = (idx: number) => {
    setCommands(commands.filter((_, i) => i !== idx));
  };

  const copyToken = () => {
    if (selectedBot) {
      navigator.clipboard.writeText(selectedBot.bot_token);
      toast.success('Đã copy token');
    }
  };

  if (loading) return null;
  if (!user) { navigate('/auth'); return null; }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-tg-sidebar flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="font-display font-bold text-lg">Bot Management</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'list' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-tg-hover'}`}>
            <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> My Bots</span>
          </button>
          <button onClick={() => setTab('create')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'create' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-tg-hover'}`}>
            <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Create Bot</span>
          </button>
        </div>

        {/* List */}
        {tab === 'list' && (
          <div>
            {loadingBots ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : bots.length === 0 ? (
              <div className="text-center py-16">
                <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold mb-2">Chưa có bot nào</h3>
                <p className="text-muted-foreground text-sm mb-4">Tạo bot đầu tiên của bạn để bắt đầu</p>
                <button onClick={() => setTab('create')} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Tạo Bot</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {bots.map(bot => (
                  <motion.div
                    key={bot.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleSelectBot(bot)}
                    className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:border-primary/30 cursor-pointer transition-colors"
                  >
                    <ChatAvatar name={bot.profiles?.display_name || 'Bot'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{bot.profiles?.display_name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">BOT</span>
                      </div>
                      <p className="text-xs text-muted-foreground">@{bot.profiles?.username}</p>
                      {bot.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{bot.description}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${bot.status === 'active' ? 'bg-tg-online/20 text-tg-online' : 'bg-destructive/10 text-destructive'}`}>
                      {bot.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create */}
        {tab === 'create' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-6 max-w-lg">
            <div className="flex items-center gap-2 mb-5">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold text-lg">Tạo Bot Mới</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tên Bot *</label>
                <input value={botName} onChange={e => setBotName(e.target.value)} placeholder="My Awesome Bot"
                  className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Username * (duy nhất)</label>
                <input value={botUsername} onChange={e => setBotUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="my_bot"
                  className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mô tả</label>
                <textarea value={botDescription} onChange={e => setBotDescription(e.target.value)} placeholder="Bot này làm gì..."
                  className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20" />
              </div>
              <button onClick={handleCreate} disabled={creating} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {creating ? 'Đang tạo...' : 'Tạo Bot'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Detail */}
        {tab === 'detail' && selectedBot && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Bot Info Card */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center gap-4 mb-6">
                <ChatAvatar name={selectedBot.profiles?.display_name || 'Bot'} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-display font-bold">{selectedBot.profiles?.display_name}</h2>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">BOT</span>
                  </div>
                  <p className="text-sm text-muted-foreground">@{selectedBot.profiles?.username}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tên Bot</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mô tả</label>
                  <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                    className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Webhook URL
                  </label>
                  <input value={editWebhook} onChange={e => setEditWebhook(e.target.value)} placeholder="https://your-server.com/webhook"
                    className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <button onClick={handleUpdate} className="px-6 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  Lưu thay đổi
                </button>
              </div>
            </div>

            {/* Token */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> API Token</h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-xs font-mono truncate">
                  {showToken ? selectedBot.bot_token : '••••••••••••••••••••'}
                </code>
                <button onClick={() => setShowToken(!showToken)} className="p-2 rounded-lg hover:bg-tg-hover">
                  {showToken ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
                <button onClick={copyToken} className="p-2 rounded-lg hover:bg-tg-hover">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <button onClick={handleResetToken} className="mt-3 flex items-center gap-1.5 text-xs text-destructive hover:underline">
                <RefreshCw className="h-3 w-3" /> Reset Token
              </button>
            </div>

            {/* Commands */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Terminal className="h-4 w-4 text-primary" /> Commands</h3>
              <div className="space-y-2 mb-4">
                {commands.map((cmd, i) => (
                  <div key={i} className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
                    <code className="text-xs font-mono text-primary font-semibold">{cmd.command}</code>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{cmd.description}</span>
                    <button onClick={() => removeCommand(i)} className="p-1 rounded hover:bg-background/50">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newCmd} onChange={e => setNewCmd(e.target.value)} placeholder="/command"
                  className="w-28 bg-secondary rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
                <input value={newCmdDesc} onChange={e => setNewCmdDesc(e.target.value)} placeholder="Mô tả command"
                  className="flex-1 bg-secondary rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30" />
                <button onClick={addCommand} className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20">Thêm</button>
              </div>
              {commands.length > 0 && (
                <button onClick={handleSaveCommands} className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                  Lưu Commands
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Settings className="h-4 w-4 text-primary" /> Hành động</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleToggleStatus} className={`px-4 py-2 rounded-xl text-xs font-medium ${selectedBot.status === 'active' ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' : 'bg-tg-online/10 text-tg-online hover:bg-tg-online/20'}`}>
                  {selectedBot.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                </button>
                <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20">
                  <span className="flex items-center gap-1"><Trash2 className="h-3 w-3" /> Xoá Bot</span>
                </button>
              </div>
            </div>

            {/* API Reference */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" /> API Reference</h3>
              <div className="space-y-3 text-xs">
                <div className="bg-secondary rounded-xl p-3">
                  <p className="font-mono text-muted-foreground mb-1">POST /functions/v1/bot-api</p>
                  <pre className="text-[11px] text-muted-foreground overflow-x-auto">{`{
  "bot_token": "YOUR_TOKEN",
  "action": "sendMessage",
  "chat_id": "conversation_uuid",
  "text": "Hello from bot!"
}`}</pre>
                </div>
                <p className="text-muted-foreground">Actions: <code className="text-primary">sendMessage</code>, <code className="text-primary">sendFile</code>, <code className="text-primary">editMessage</code>, <code className="text-primary">deleteMessage</code>, <code className="text-primary">getUpdates</code></p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
};

export default BotDashboard;
