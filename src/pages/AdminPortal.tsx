import React, { useCallback, useEffect, useState } from 'react';
import { formatUsername } from '@/lib/chatUtils';
import { motion } from 'framer-motion';
import { Shield, Moon, Sun, ArrowLeft, CheckCircle, XCircle, RefreshCw, LogOut, Users, MessageSquare, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/hooks/useThemeMode';

interface PendingUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  created_at: string;
}

const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeMode();
  const { user, isAdmin, loading: authLoading, signIn, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);
  const [stats, setStats] = useState({ users: 0, messages: 0, conversations: 0 });

  const authed = !!user && isAdmin;

  const loadAll = useCallback(async () => {
    setLoadingList(true);
    try {
      const [pendingRes, settingsRes] = await Promise.all([
        supabase.functions.invoke('manage-user', { body: { action: 'list-pending' } }),
        supabase.functions.invoke('manage-user', { body: { action: 'get-settings' } }),
      ]);
      if (pendingRes.error) throw pendingRes.error;
      setPending(pendingRes.data?.users || []);
      setAutoApprove(!!settingsRes.data?.autoApprove);

      const [{ count: users }, { count: messages }, { count: conversations }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ users: users || 0, messages: messages || 0, conversations: conversations || 0 });
    } catch (err: any) {
      toast.error('Lỗi tải dữ liệu: ' + (err.message || 'Unknown'));
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (authed) loadAll();
  }, [authed, loadAll]);

  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      toast.error('Tài khoản này không phải Admin');
      supabase.auth.signOut();
    }
  }, [authLoading, user, isAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  const handleApprove = async (userId: string) => {
    setProcessing(userId);
    const { error } = await supabase.functions.invoke('manage-user', { body: { action: 'approve', userId } });
    if (error) toast.error('Lỗi: ' + error.message);
    else { toast.success('Đã duyệt tài khoản'); setPending(p => p.filter(u => u.id !== userId)); }
    setProcessing(null);
  };

  const handleReject = async (userId: string) => {
    setProcessing(userId);
    const { error } = await supabase.functions.invoke('manage-user', { body: { action: 'reject', userId } });
    if (error) toast.error('Lỗi: ' + error.message);
    else { toast.success('Đã từ chối & xoá tài khoản'); setPending(p => p.filter(u => u.id !== userId)); }
    setProcessing(null);
  };

  const handleToggleAutoApprove = async () => {
    const next = !autoApprove;
    setSavingSetting(true);
    const { error } = await supabase.functions.invoke('manage-user', {
      body: { action: 'set-auto-approve', enabled: next },
    });
    if (error) toast.error('Lỗi: ' + error.message);
    else {
      setAutoApprove(next);
      toast.success(next ? 'Đã bật: tài khoản mới sẽ tự động được duyệt' : 'Đã tắt: tài khoản mới cần Admin duyệt');
    }
    setSavingSetting(false);
  };

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Đổi giao diện sáng/tối"
      className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/60 px-3 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground backdrop-blur hover:text-primary hover:border-primary/60 transition-all"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
        <div className="absolute inset-0 dots-bg opacity-70 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute top-5 right-5 z-10">{themeButton}</div>
        <button
          onClick={() => navigate('/auth')}
          className="absolute top-5 left-5 z-10 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 gradient-primary rounded-2xl blur-lg opacity-60 animate-pulse-glow" />
              <div className="relative w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-elevated">
                <Shield className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-gradient">Admin Portal</h1>
            <p className="text-muted-foreground text-sm mt-2 font-mono">// restricted access — admins only</p>
          </div>

          <div className="glass rounded-2xl p-6 shadow-elevated">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">Email admin</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required
                  className="w-full bg-secondary/60 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">Mật khẩu</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                  className="w-full bg-secondary/60 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full gradient-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 hover:shadow-glow transition-all disabled:opacity-50">
                {submitting ? 'Đang xác thực...' : 'Đăng nhập Admin →'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-display font-semibold">Admin Portal</h1>
          </div>
          <div className="flex items-center gap-2">
            {themeButton}
            <button onClick={loadAll} className="p-2 rounded-xl hover:bg-tg-hover text-muted-foreground hover:text-primary transition-colors" aria-label="Tải lại">
              <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => navigate('/')} className="px-3 py-2 rounded-xl text-xs font-mono uppercase text-muted-foreground hover:text-primary transition-colors">App</button>
            <button onClick={async () => { await signOut(); navigate('/auth'); }} className="p-2 rounded-xl hover:bg-tg-hover text-muted-foreground hover:text-destructive transition-colors" aria-label="Đăng xuất">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Người dùng', value: stats.users },
            { icon: MessageSquare, label: 'Tin nhắn', value: stats.messages },
            { icon: Hash, label: 'Cuộc trò chuyện', value: stats.conversations },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-4">
              <s.icon className="h-4 w-4 text-primary mb-2" />
              <p className="text-2xl font-display font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">Tự động duyệt tài khoản mới</p>
            <p className="text-xs text-muted-foreground mt-1">
              Khi bật, mọi tài khoản đăng ký từ thời điểm này sẽ được kích hoạt ngay, không cần Admin duyệt.
            </p>
          </div>
          <button
            onClick={handleToggleAutoApprove}
            disabled={savingSetting}
            role="switch"
            aria-checked={autoApprove}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${autoApprove ? 'bg-primary' : 'bg-secondary border border-border'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-background shadow transition-all ${autoApprove ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="font-display font-semibold text-sm">Tài khoản chờ duyệt</h2>
            <span className="text-xs font-mono text-muted-foreground">{pending.length}</span>
          </div>
          <div className="p-4">
            {loadingList ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Không có tài khoản nào chờ duyệt</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map(u => (
                  <div key={u.id} className={`flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors ${processing === u.id ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.display_name}</p>
                      <p className="text-xs text-muted-foreground">{formatUsername(u.username)} · {u.email}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(u.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <button onClick={() => handleApprove(u.id)} title="Duyệt" className="p-2 rounded-lg hover:bg-tg-hover text-tg-online transition-colors">
                      <CheckCircle className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleReject(u.id)} title="Từ chối & xoá" className="p-2 rounded-lg hover:bg-tg-hover text-destructive transition-colors">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPortal;
