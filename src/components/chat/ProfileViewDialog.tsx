import React, { useState } from 'react';
import { X, UserPlus, Check, Clock, UserMinus, MessageCircle, Ban, XCircle } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { motion } from 'framer-motion';
import { formatLastSeen } from '@/lib/chatUtils';

interface Props {
  userId: string;
  onClose: () => void;
}

const ProfileViewDialog: React.FC<Props> = ({ userId, onClose }) => {
  const { profiles, getFriendshipWith, sendFriendRequest, acceptFriendRequest, removeFriend, cancelFriendRequest, declineFriendRequest, createPrivateChat, setActiveConversation, blockUser, isBlocked } = useChatContext();
  const { user } = useAuth();
  const profile = profiles[userId];
  const friendship = getFriendshipWith(userId);

  if (!profile) return null;

  const isMe = user?.id === userId;
  const blocked = isBlocked(userId);

  const getFriendStatus = () => {
    if (!friendship) return 'none';
    if (friendship.status === 'accepted') return 'friend';
    if (friendship.status === 'pending' && friendship.requester_id === user?.id) return 'sent';
    if (friendship.status === 'pending' && friendship.addressee_id === user?.id) return 'received';
    return 'none';
  };

  const status = getFriendStatus();

  const handleMessage = async () => {
    const convId = await createPrivateChat(userId);
    if (convId) {
      setActiveConversation(convId);
      onClose();
    }
  };

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

          {/* Friend actions */}
          {!isMe && !profile.is_bot && !blocked && (
            <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
              {status === 'none' && (
                <button
                  onClick={() => sendFriendRequest(userId)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Kết bạn
                </button>
              )}
              {status === 'sent' && (
                <button
                  onClick={() => friendship && cancelFriendRequest(friendship.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Huỷ lời mời
                </button>
              )}
              {status === 'received' && (
                <>
                  <button
                    onClick={() => friendship && acceptFriendRequest(friendship.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Chấp nhận
                  </button>
                  <button
                    onClick={() => friendship && declineFriendRequest(friendship.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </button>
                </>
              )}
              {status === 'friend' && (
                <button
                  onClick={() => friendship && removeFriend(friendship.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                >
                  <UserMinus className="h-4 w-4" />
                  Huỷ kết bạn
                </button>
              )}
              <button
                onClick={handleMessage}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Nhắn tin
              </button>
            </div>
          )}

          {/* Block button */}
          {!isMe && !profile.is_bot && (
            <button
              onClick={() => { blockUser(userId); onClose(); }}
              className="flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              <Ban className="h-4 w-4" />
              {blocked ? 'Đã chặn' : 'Chặn người dùng'}
            </button>
          )}

          <div className="mt-4 w-full space-y-2 text-sm">
            <div className="flex justify-between px-2 py-1.5 rounded-lg bg-secondary/50">
              <span className="text-muted-foreground">Username</span>
              <span>@{profile.username}</span>
            </div>
            <div className="flex justify-between px-2 py-1.5 rounded-lg bg-secondary/50">
              <span className="text-muted-foreground">Tham gia / Joined</span>
              <span>{new Date(profile.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
            {status === 'friend' && (
              <div className="flex justify-between px-2 py-1.5 rounded-lg bg-primary/5">
                <span className="text-muted-foreground">Trạng thái / Status</span>
                <span className="text-primary font-medium">✓ Bạn bè / Friends</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileViewDialog;
