import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useThemeMode } from '@/hooks/useThemeMode';
import { supabase } from '@/integrations/supabase/client';

const AuthPage: React.FC = () => {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeMode();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminShortcut, setAdminShortcut] = useState(false);


  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminShortcut) {
      setAdminShortcut(false);
      navigate('/admin-portal');
      return;
    }
    setSubmitting(true);
    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          toast.error('Tài khoản chưa được kích hoạt. Vui lòng chờ Admin duyệt tài khoản của bạn.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Đăng nhập thành công!');
        navigate('/');
      }
    } else {
      if (!username.trim() || !displayName.trim()) { toast.error('Vui lòng điền đầy đủ thông tin'); setSubmitting(false); return; }
      const { error } = await signUp(email, password, username.trim().replace(/^@+/, '').split('@')[0], displayName);
      if (error) {
        toast.error(error.message);
      } else {
        let autoApproved = false;
        try {
          const { data } = await supabase.functions.invoke('manage-user', {
            body: { action: 'auto-approve-self', email },
          });
          autoApproved = !!data?.approved;
        } catch { /* ignore */ }
        if (autoApproved) {
          const { error: signInError } = await signIn(email, password);
          if (!signInError) {
            toast.success('Đăng ký thành công! Tài khoản đã được kích hoạt tự động.');
            navigate('/');
            setSubmitting(false);
            return;
          }
          toast.success('Đăng ký thành công! Tài khoản đã được kích hoạt, vui lòng đăng nhập.');
          setIsLogin(true);
        } else {
          toast.success('Đăng ký thành công! Tài khoản của bạn đang chờ Admin duyệt. Vui lòng đợi thông báo kích hoạt.');
        }
      }
    }
    setSubmitting(false);
  };


  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 dots-bg opacity-70 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/20 blur-3xl pointer-events-none" />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        className="absolute top-5 right-5 z-10 flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/60 px-3 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground backdrop-blur hover:text-primary hover:border-primary/60 transition-all"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>


      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 gradient-primary rounded-2xl blur-lg opacity-60 animate-pulse-glow" />
            <div className="relative w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-elevated">
              <img src={logoImg} alt="Chim Cu Gáy" className="w-10 h-10 rounded-full" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight">
            <span className="text-gradient">Chim Cu Gáy</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2 font-mono">
            {isLogin ? '// secure realtime messaging' : '// create your account'}
          </p>
        </div>

        <div className="glass rounded-2xl p-6 shadow-elevated">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">Username</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" className="w-full bg-secondary/60 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" required />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">Tên hiển thị</label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nguyễn Văn A" className="w-full bg-secondary/60 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" required />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-secondary/60 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" required />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-secondary/60 border border-border/60 rounded-xl px-4 py-2.5 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              onClick={e => setAdminShortcut(e.ctrlKey || e.metaKey)}
              className="w-full gradient-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 hover:shadow-glow transition-all disabled:opacity-50"
            >
              {submitting ? 'Đang xử lý...' : isLogin ? 'Đăng nhập →' : 'Tạo tài khoản →'}
            </button>
          </form>
          <div className="mt-5 text-center">
            <button
              onClick={e => {
                if (e.ctrlKey || e.metaKey) { navigate('/admin-portal'); return; }
                setIsLogin(p => !p);
              }}
              className="text-sm text-primary hover:text-primary-glow transition-colors"
            >
              {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
