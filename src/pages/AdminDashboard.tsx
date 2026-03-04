import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Hash, Shield, ArrowLeft, Trash2, Lock, Unlock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ChatAvatar from '@/components/chat/ChatAvatar';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface Stats {
  users: number;
  messages: number;
  conversations: number;
  groups: number;
}

const AdminDashboard: React.FC = () => {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ users: 0, messages: 0, conversations: 0, groups: 0 });
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tab, setTab] = useState<'stats' | 'users'>('stats');

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
      toast.error('Bạn không có quyền truy cập');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchData = async () => {
      setLoadingData(true);
      const [
        { count: userCount },
        { count: msgCount },
        { count: convCount },
        { data: profilesData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      ]);

      const { count: groupCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'group');

      setStats({
        users: userCount || 0,
        messages: msgCount || 0,
        conversations: convCount || 0,
        groups: groupCount || 0,
      });
      setUsers(profilesData || []);
      setLoadingData(false);
    };
    fetchData();
  }, [isAdmin]);

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-tg-sidebar">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-tg-hover transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="font-display font-bold text-lg">Admin Dashboard</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('stats')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'stats' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-tg-hover'
            }`}
          >
            Thống kê
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'users' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-tg-hover'
            }`}
          >
            Quản lý Users
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : tab === 'stats' ? (
          <StatsView stats={stats} />
        ) : (
          <UsersView users={users} isSuperAdmin={isSuperAdmin} />
        )}
      </div>
    </div>
  );
};

const StatsView: React.FC<{ stats: Stats }> = ({ stats }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard icon={Users} label="Người dùng" value={stats.users} color="text-blue-500" />
    <StatCard icon={MessageSquare} label="Tin nhắn" value={stats.messages} color="text-emerald-500" />
    <StatCard icon={Hash} label="Cuộc trò chuyện" value={stats.conversations} color="text-amber-500" />
    <StatCard icon={Users} label="Nhóm" value={stats.groups} color="text-violet-500" />
  </div>
);

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card rounded-2xl border border-border p-5"
  >
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-xl bg-secondary ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <p className="text-3xl font-display font-bold">{value.toLocaleString()}</p>
  </motion.div>
);

const UsersView: React.FC<{ users: Profile[]; isSuperAdmin: boolean }> = ({ users, isSuperAdmin }) => (
  <div className="bg-card rounded-2xl border border-border overflow-hidden">
    <div className="px-4 py-3 border-b border-border">
      <h3 className="font-semibold text-sm">Danh sách người dùng ({users.length})</h3>
    </div>
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
          <span className="text-xs text-muted-foreground">
            {new Date(u.created_at).toLocaleDateString('vi-VN')}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default AdminDashboard;
