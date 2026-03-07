import React from 'react';
import { X } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import ChatAvatar from './ChatAvatar';
import { motion } from 'framer-motion';
import { formatLastSeen } from '@/lib/chatUtils';

interface Props {
  userId: string;
  onClose: () => void;
}

const ProfileViewDialog: React.FC<Props> = ({ userId, onClose }) => {
  const { profiles } = useChatContext();
  const profile = profiles[userId];

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6"
      >
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col items-center">
          <ChatAvatar name={profile.display_name} avatar={profile.avatar_url || undefined} online={profile.online ?? false} size="lg" />
          <h3 className="mt-3 text-lg font-display font-semibold">{profile.display_name}</h3>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <p className={`text-xs mt-1 ${profile.online ? 'text-tg-online' : 'text-muted-foreground'}`}>
            {profile.online ? 'Online' : profile.last_seen ? formatLastSeen(new Date(profile.last_seen)) : 'Offline'}
          </p>
          {profile.bio && (
            <p className="text-sm text-foreground mt-4 text-center">{profile.bio}</p>
          )}
          <div className="mt-4 w-full space-y-2 text-sm">
            <div className="flex justify-between px-2 py-1.5 rounded-lg bg-secondary/50">
              <span className="text-muted-foreground">Username</span>
              <span>@{profile.username}</span>
            </div>
            <div className="flex justify-between px-2 py-1.5 rounded-lg bg-secondary/50">
              <span className="text-muted-foreground">Tham gia</span>
              <span>{new Date(profile.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileViewDialog;
