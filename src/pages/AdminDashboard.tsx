import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Hash, Shield, ArrowLeft, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ChatAvatar from '@/components/chat/ChatAvatar';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface UserWithRole extends Profile {
  userRole?: string;
}

interface Stats {
  users: number;
  messages: number;
  conversations: number;
  groups: number;
}

const AdminDashboard: React.FC = () => {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ users: 0, messages: 0, conversations: 0, groups: 0 });
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tab, setTab] = useState<'stats' | 'users' | 'create' | 'permissions'>('stats');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [massUpdating, setMassUpdating] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) { navigate('/'); toast.error('Bạn không có quyền truy cập'); }
  }, [isAdmin, loading, navigate]);

  const fetchData = async () => {
    if (!isAdmin) return;
    setLoadingData(true);
    const [{ count: userCount }, { count: msgCount }, { count: convCount }, { data: profilesData }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    const { count: groupCount } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('type', 'group');

    // Fetch roles for all users
    const { data: rolesData } = await supabase.from('user_roles').select('*');
    const roleMap: Record<string, string> = {};
    rolesData?.forEach(r => { roleMap[r.user_id] = r.role; });

    const usersWithRoles: UserWithRole[] = (profilesData || []).map(p => ({ ...p, userRole: roleMap[p.id] || 'user' }));

    setStats({ users: userCount || 0, messages: msgCount || 0, conversations: convCount || 0, groups: groupCount || 0 });
    setUsers(usersWithRoles);
    setLoadingData(false);
  };

  useEffect(() => { fetchData(); }, [isAdmin]);

  const handleCreateAccount = async () => {
    if (!newEmail || !newPassword || !newUsername || !newDisplayName) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'create', email: newEmail, password: newPassword, username: newUsername, displayName: newDisplayName, role: newRole },
      });
      if (error) throw error;
      toast.success('Tạo tài khoản thành công!');
      setNewEmail(''); setNewPassword(''); setNewUsername(''); setNewDisplayName(''); setNewRole('user');
      fetchData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
    setCreating(false);
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'set-role', userId, role: newRole },
      });
      if (error) throw error;
      toast.success('Đã cập nhật role');
      fetchData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const handleMassUpdateToUser = async () => {
    if (!window.confirm('Đổi tất cả admin (trừ bạn) thành user?')) return;
    setMassUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'mass-update-to-user', currentUserId: user?.id },
      });
      if (error) throw error;
      toast.success('Đã cập nhật tất cả thành user');
      fetchData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
    setMassUpdating(false);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
  if (!isAdmin) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="border-b border-border bg-tg-sidebar flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-tg-hover transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="font-display font-bold text-lg">Admin Dashboard - Chim Cu Gáy</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['stats', 'users', 'permissions', 'create'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-tg-hover'}`}>
              {t === 'stats' ? 'Thống kê' : t === 'users' ? 'Quản lý Users' : t === 'permissions' ? 'Phân quyền' : 'Tạo tài khoản'}
            </button>
          ))}
        </div>
        {loadingData ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>
        ) : tab === 'stats' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Người dùng" value={stats.users} color="text-blue-500" />
            <StatCard icon={MessageSquare} label="Tin nhắn" value={stats.messages} color="text-emerald-500" />
            <StatCard icon={Hash} label="Cuộc trò chuyện" value={stats.conversations} color="text-amber-500" />
            <StatCard icon={Users} label="Nhóm" value={stats.groups} color="text-violet-500" />
          </div>
        ) : tab === 'users' ? (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-sm">Danh sách người dùng ({users.length})</h3></div>
            <div className="divide-y divide-border">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-tg-hover transition-colors">
                  <ChatAvatar name={u.display_name} online={u.online ?? false} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.online ? 'bg-tg-online/20 text-tg-online' : 'bg-muted text-muted-foreground'}`}>
                    {u.online ? 'Online' : 'Offline'}
                  </span>
                  <select
                    value={u.userRole || 'user'}
                    onChange={e => handleChangeRole(u.id, e.target.value)}
                    disabled={u.id === user?.id}
                    className="text-xs bg-secondary rounded-lg px-2 py-1 outline-none border border-border"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'permissions' ? (
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md">
            <h3 className="font-display font-semibold mb-4 text-lg">Quản lý phân quyền</h3>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/10 border border-amber-200/20 rounded-xl">
                <h4 className="font-semibold text-amber-600 mb-2">⚠️ Thao tác nguy hiểm</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Chuyển tất cả admin (trừ bạn) thành user. Chỉ bạn sẽ là admin duy nhất.
                </p>
                <button 
                  onClick={handleMassUpdateToUser}
                  disabled={massUpdating}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {massUpdating ? 'Đang xử lý...' : 'Thu hồi quyền admin tất cả'}
                </button>
              </div>
              <div className="text-xs text-muted-foreground p-3 bg-secondary/50 rounded-xl">
                <p className="font-medium mb-1">Lưu ý:</p>
                <ul className="space-y-1 ml-3">
                  <li>• Các user thường chỉ thấy admin hiển thị như user bình thường</li>
                  <li>• Chỉ admin mới thấy được role thật của nhau</li>
                  <li>• Thao tác này không thể hoàn tác</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-primary" />
              <h3 className="font-display font-semibold">Tạo tài khoản mới</h3>
            </div>
            <div className="space-y-3">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mật khẩu" type="password" className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username" className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Tên hiển thị" className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none border border-border focus:ring-2 focus:ring-primary/30">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={handleCreateAccount} disabled={creating} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-5">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-xl bg-secondary ${color}`}><Icon className="h-5 w-5" /></div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className="text-3xl font-display font-bold">{value.toLocaleString()}</p>
  </motion.div>
);

export default AdminDashboard;
