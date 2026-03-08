import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
      if (!username.trim() || !displayName.trim()) { toast.error('Vui lòng điền đầy đủ thông tin'); setLoading(false); return; }
      const { error } = await signUp(email, password, username, displayName);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Đăng ký thành công! Tài khoản của bạn đang chờ Admin duyệt. Vui lòng đợi thông báo kích hoạt.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Send className="h-8 w-8 text-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">Chim Cu Gáy</h1>
          <p className="text-muted-foreground text-sm mt-1">{isLogin ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản mới'}</p>
        </div>
        <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Username</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Tên hiển thị</label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Nguyễn Văn A" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all" required />
                </div>
              </>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="w-full bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-secondary rounded-xl px-4 py-2.5 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(p => !p)} className="text-sm text-primary hover:underline">
              {isLogin ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
