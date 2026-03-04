import React from 'react';
import { X, Bell, BellOff, Trash2, Users, Image, FileText, Link } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import ChatAvatar from './ChatAvatar';
import { CURRENT_USER } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';

const InfoPanel: React.FC = () => {
  const { activeConversation, showInfoPanel, toggleInfoPanel } = useChatContext();

  if (!activeConversation) return null;

  const otherMember = activeConversation.type === 'private'
    ? activeConversation.members.find(m => m.id !== CURRENT_USER.id)
    : undefined;

  return (
    <AnimatePresence>
      {showInfoPanel && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-l border-border bg-tg-sidebar h-full overflow-hidden flex-shrink-0"
        >
          <div className="w-80 h-full flex flex-col overflow-y-auto scrollbar-thin">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Thông tin</h3>
              <button onClick={toggleInfoPanel} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Profile */}
            <div className="flex flex-col items-center py-6 px-4">
              <ChatAvatar name={activeConversation.name} online={otherMember?.online} size="lg" />
              <h4 className="mt-3 font-semibold text-lg">{activeConversation.name}</h4>
              {otherMember && (
                <p className="text-sm text-muted-foreground">@{otherMember.username}</p>
              )}
              {activeConversation.type !== 'private' && (
                <p className="text-sm text-muted-foreground mt-1">
                  {activeConversation.members.length} thành viên
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="px-2 space-y-0.5">
              <InfoButton icon={Bell} label="Thông báo" detail="Bật" />
              {activeConversation.type !== 'private' && (
                <InfoButton icon={Users} label="Thành viên" detail={`${activeConversation.members.length}`} />
              )}
              <InfoButton icon={Image} label="Ảnh & Video" detail="0" />
              <InfoButton icon={FileText} label="Tệp" detail="0" />
              <InfoButton icon={Link} label="Liên kết" detail="0" />
            </div>

            {/* Members for groups */}
            {activeConversation.type !== 'private' && (
              <div className="mt-4 px-4">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Thành viên
                </h5>
                <div className="space-y-1">
                  {activeConversation.members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-tg-hover transition-colors cursor-pointer">
                      <ChatAvatar name={m.displayName} online={m.online} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.online ? 'online' : 'offline'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger zone */}
            <div className="mt-auto px-2 pb-4 pt-4">
              <button className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-sm">
                <Trash2 className="h-4 w-4" />
                <span>{activeConversation.type === 'private' ? 'Xoá cuộc trò chuyện' : 'Rời nhóm'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const InfoButton: React.FC<{ icon: React.ElementType; label: string; detail: string }> = ({ icon: Icon, label, detail }) => (
  <button className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-tg-hover transition-colors text-sm">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="flex-1 text-left">{label}</span>
    <span className="text-muted-foreground text-xs">{detail}</span>
  </button>
);

export default InfoPanel;
