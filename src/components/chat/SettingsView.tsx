import React, { useState } from 'react';
import { Moon, Sun, Shield, Bot, Ban, LogOut, Bookmark, User, ChevronLeft } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import EditProfileDialog from './EditProfileDialog';
import ChatAvatar from './ChatAvatar';
import { formatUsername } from '@/lib/chatUtils';

const SettingsView: React.FC = () => {
  const { darkMode, toggleDarkMode, ensureSavedMessages, openBotFatherChat, blockedUsers, unblockUser, profiles } = useChatContext();
  const { signOut, isAdmin } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const items = [
    { icon: User, label: 'Chỉnh sửa Profile', onClick: () => setShowEditProfile(true) },
    { icon: darkMode ? Sun : Moon, label: darkMode ? 'Chế độ sáng' : 'Chế độ tối', onClick: toggleDarkMode },
    { icon: Bookmark, label: 'Saved Messages', onClick: () => ensureSavedMessages() },
    { icon: Bot, label: '🤖 BotFather', onClick: () => openBotFatherChat() },
    { icon: Bot, label: 'Bot Management', onClick: () => { window.location.href = '/bots'; } },
    ...(isAdmin ? [
      { icon: Shield, label: 'Admin Dashboard', onClick: () => { window.location.href = '/admin'; } },
    ] : []),
    { icon: Ban, label: `Người dùng đã chặn (${blockedUsers.length})`, onClick: () => setShowBlocked(true) },
  ];

  return (
    <div className="flex flex-col h-full bg-tg-sidebar dots-bg-soft">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        {showBlocked && (
          <button onClick={() => setShowBlocked(false)} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="font-display font-semibold text-lg">{showBlocked ? 'Người dùng đã chặn' : 'Cài đặt'}</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {showBlocked ? (
          <div className="px-4 space-y-2">
            {blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chưa chặn ai</p>
            ) : (
              blockedUsers.map(uid => {
                const p = profiles[uid];
                if (!p) return null;
                return (
                  <div key={uid} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/50">
                    <ChatAvatar name={p.display_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{formatUsername(p.username)}</p>
                    </div>
                    <button onClick={() => unblockUser(uid)} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors">
                      Bỏ chặn
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="px-2 space-y-1">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-tg-hover transition-colors text-left"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
            <div className="border-t border-border my-2" />
            <button
              onClick={signOut}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-destructive/10 transition-colors text-left"
            >
              <LogOut className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">Đăng xuất</span>
            </button>
          </div>
        )}
      </div>

      {showEditProfile && <EditProfileDialog onClose={() => setShowEditProfile(false)} />}
    </div>
  );
};

export default SettingsView;
