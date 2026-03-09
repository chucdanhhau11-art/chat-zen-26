import React from 'react';
import { MessageCircle, Users, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'chat' | 'contacts' | 'settings' | 'profile';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
  unreadCount?: number;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onChangeTab, unreadCount = 0 }) => {
  const tabs: { id: MobileTab; label: string; icon: React.ElementType }[] = [
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'contacts', label: 'Danh bạ', icon: Users },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
    { id: 'profile', label: 'Hồ sơ', icon: User },
  ];

  return (
    <div className="flex items-center justify-around border-t border-border bg-tg-sidebar h-14 flex-shrink-0 md:hidden">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {tab.id === 'chat' && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-tg-unread text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MobileBottomNav;
