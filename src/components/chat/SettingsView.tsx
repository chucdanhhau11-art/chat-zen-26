import React from 'react';
import { Moon, Sun, Bell, Shield, Bot, Mail, Ban, LogOut, Bookmark } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';

const SettingsView: React.FC = () => {
  const { darkMode, toggleDarkMode, ensureSavedMessages, openBotFatherChat, blockedUsers } = useChatContext();
  const { signOut, isAdmin } = useAuth();

  const items = [
    { icon: darkMode ? Sun : Moon, label: darkMode ? 'Chế độ sáng' : 'Chế độ tối', onClick: toggleDarkMode },
    { icon: Bookmark, label: 'Saved Messages', onClick: () => ensureSavedMessages() },
    { icon: Bot, label: '🤖 BotFather', onClick: () => openBotFatherChat() },
    { icon: Bot, label: 'Bot Management', onClick: () => { window.location.href = '/bots'; } },
    ...(isAdmin ? [
      { icon: Shield, label: 'Admin Dashboard', onClick: () => { window.location.href = '/admin'; } },
    ] : []),
    { icon: Ban, label: `Người dùng đã chặn (${blockedUsers.length})`, onClick: () => {} },
  ];

  return (
    <div className="flex flex-col h-full bg-tg-sidebar">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display font-semibold text-lg mb-3">Cài đặt</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
      </div>
    </div>
  );
};

export default SettingsView;
