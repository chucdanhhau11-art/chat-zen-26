import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ChatAvatar from './ChatAvatar';

const EditProfileDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { profile, user } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !displayName.trim() || !username.trim()) {
      toast.error('Tên và username không được để trống');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim(),
      username: username.trim(),
      bio: bio.trim() || null,
    }).eq('id', user.id);
    if (error) {
      toast.error('Lỗi: ' + error.message);
    } else {
      toast.success('Đã cập nhật profile');
      onClose();
      // Reload page to refresh context
      window.location.reload();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Chỉnh sửa Profile</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col items-center mb-4">
          <ChatAvatar name={displayName || 'U'} size="lg" />
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Tên hiển thị</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Giới thiệu về bạn..." />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EditProfileDialog;
