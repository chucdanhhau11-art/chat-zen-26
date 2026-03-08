import React from 'react';
import { X, Bell, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatTime } from '@/lib/chatUtils';

export interface NotificationItem {
  id: string;
  conversationId: string;
  conversationName: string;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

interface NotificationPanelProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onClear: () => void;
  onClickNotification: (notif: NotificationItem) => void;
  onMarkAllRead: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications, onClose, onClear, onClickNotification, onMarkAllRead,
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/30" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        className="bg-popover border border-border rounded-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold text-sm">Thông báo</h3>
            {unreadCount > 0 && (
              <span className="bg-tg-unread text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <button onClick={onMarkAllRead} className="text-[11px] text-primary hover:underline px-2 py-1">
                  Đánh dấu đã đọc
                </button>
                <button onClick={onClear} className="text-[11px] text-muted-foreground hover:text-destructive px-2 py-1">
                  Xoá tất cả
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Không có thông báo</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => onClickNotification(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-tg-hover transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="mt-0.5">
                    <MessageSquare className={`h-4 w-4 ${!n.read ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium truncate ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {n.senderName}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatTime(new Date(n.timestamp))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{n.conversationName}</p>
                    <p className={`text-xs mt-0.5 truncate ${!n.read ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                      {n.content}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="mt-2 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NotificationPanel;
