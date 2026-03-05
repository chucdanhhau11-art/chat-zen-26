import React, { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ChatAvatar from './ChatAvatar';
import { motion } from 'framer-motion';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface PendingUser {
  profile: Profile;
  email: string;
  confirmed: boolean;
}

const AdminEmailApproval: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // Get all profiles
    const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    if (profilesData) {
      // We show all users - admin can see their status
      const userList: PendingUser[] = profilesData.map(p => ({
        profile: p,
        email: `${p.username}@...`, // We don't have direct access to email from profiles
        confirmed: true, // Will be updated by edge function
      }));
      setUsers(userList);
    }
    setLoading(false);
  };

  const handleApprove = async (userId: string) => {
    try {
      // Call edge function to confirm user email
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'approve', userId },
      });
      if (error) throw error;
      toast.success('Đã duyệt tài khoản');
      setUsers(prev => prev.map(u => u.profile.id === userId ? { ...u, confirmed: true } : u));
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'ban', userId },
      });
      if (error) throw error;
      toast.success('Đã từ chối tài khoản');
      setUsers(prev => prev.filter(u => u.profile.id !== userId));
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Unknown'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-popover border border-border rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold">Duyệt tài khoản</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Không có tài khoản nào</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.profile.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                  <ChatAvatar name={u.profile.display_name} online={u.profile.online ?? false} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.profile.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.profile.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(u.profile.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleApprove(u.profile.id)}
                      className="p-2 rounded-lg hover:bg-tg-hover transition-colors text-tg-online"
                      title="Duyệt"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleReject(u.profile.id)}
                      className="p-2 rounded-lg hover:bg-tg-hover transition-colors text-destructive"
                      title="Từ chối"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminEmailApproval;
