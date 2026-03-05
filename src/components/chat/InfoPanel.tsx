import React from 'react';
import { X, Bell, Trash2, Users, Image, FileText, Link } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { motion, AnimatePresence } from 'framer-motion';

const InfoPanel: React.FC = () => {
  const { activeConversation, showInfoPanel, toggleInfoPanel, profiles, deleteConversation } = useChatContext();
  const { user } = useAuth();

  if (!activeConversation) return null;

  const getConvName = () => {
    if (activeConversation.name) return activeConversation.name;
    if (activeConversation.type === 'private' && user) {
      const other = activeConversation.members.find(m => m.user_id !== user.id);
      return other ? profiles[other.user_id]?.display_name || 'Unknown' : 'Chat';
    }
    return 'Chat';
  };

  const getOtherOnline = () => {
    if (activeConversation.type !== 'private' || !user) return undefined;
    const other = activeConversation.members.find(m => m.user_id !== user.id);
    return other ? profiles[other.user_id]?.online ?? false : false;
  };

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
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Thông tin</h3>
              <button onClick={toggleInfoPanel} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-col items-center py-6 px-4">
              <ChatAvatar name={getConvName()} online={getOtherOnline()} size="lg" />
              <h4 className="mt-3 font-semibold text-lg">{getConvName()}</h4>
              {activeConversation.type !== 'private' && (
                <p className="text-sm text-muted-foreground mt-1">{activeConversation.members.length} thành viên</p>
              )}
            </div>

            <div className="px-2 space-y-0.5">
              <InfoButton icon={Bell} label="Thông báo" detail="Bật" />
              {activeConversation.type !== 'private' && (
                <InfoButton icon={Users} label="Thành viên" detail={`${activeConversation.members.length}`} />
              )}
              <InfoButton icon={Image} label="Ảnh & Video" detail="0" />
              <InfoButton icon={FileText} label="Tệp" detail="0" />
              <InfoButton icon={Link} label="Liên kết" detail="0" />
            </div>

            {activeConversation.type !== 'private' && (
              <div className="mt-4 px-4">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Thành viên</h5>
                <div className="space-y-1">
                  {activeConversation.members.map(m => {
                    const p = profiles[m.user_id];
                    if (!p) return null;
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-tg-hover transition-colors cursor-pointer">
                        <ChatAvatar name={p.display_name} online={p.online ?? false} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.display_name}</p>
                          <p className="text-xs text-muted-foreground">{p.online ? 'online' : 'offline'}</p>
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto px-2 pb-4 pt-4">
              <button
                onClick={async () => {
                  if (window.confirm(activeConversation.type === 'private' ? 'Xoá cuộc trò chuyện này?' : 'Xoá nhóm trò chuyện này?')) {
                    await deleteConversation(activeConversation.id);
                  }
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                <span>{activeConversation.type === 'private' ? 'Xoá cuộc trò chuyện' : 'Xoá nhóm'}</span>
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
