import React from 'react';
import { X, User, Bot, Ban, Moon, Sun, Shield, Mail, Settings as SettingsIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { formatUsername } from '@/lib/chatUtils';

interface SettingsDialogProps {
  onClose: () => void;
  onEditProfile: () => void;
  onEmailApproval: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose, onEditProfile, onEmailApproval }) => {
  const { darkMode, toggleDarkMode, openBotFatherChat, blockedUsers, unblockUser, profiles } = useChatContext();
  const { isAdmin } = useAuth();
  const [showBlocked, setShowBlocked] = React.useState(false);

  const Row: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; right?: React.ReactNode; danger?: boolean }> = ({ icon: Icon, label, onClick, right, danger }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-tg-hover transition-colors text-left"
    >
      <Icon className={`h-4 w-4 ${danger ? 'text-destructive' : 'text-primary'}`} />
      <span className="text-sm font-medium flex-1">{label}</span>
      {right}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" /> Cài đặt
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {!showBlocked ? (
            <>
              <Row icon={User} label="Chỉnh sửa Profile" onClick={() => { onClose(); onEditProfile(); }} />
              <Row icon={Bot} label="Bot Management" onClick={() => { window.location.href = '/bots'; }} />
              <Row icon={Bot} label="🤖 BotFather" onClick={async () => { onClose(); await openBotFatherChat(); }} />
              <Row
                icon={Ban}
                danger
                label="Người dùng đã chặn"
                onClick={() => setShowBlocked(true)}
                right={<span className="text-[11px] text-muted-foreground">{blockedUsers.length}</span>}
              />
              <div className="border-t border-border my-2" />
              <Row
                icon={darkMode ? Sun : Moon}
                label={darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
                onClick={toggleDarkMode}
              />
              {isAdmin && (
                <>
                  <div className="border-t border-border my-2" />
                  <Row icon={Mail} label="Duyệt email đăng ký" onClick={() => { onClose(); onEmailApproval(); }} />
                  <Row icon={Shield} label="Admin Dashboard" onClick={() => { window.location.href = '/admin'; }} />
                </>
              )}
            </>
          ) : (
            <div>
              <button onClick={() => setShowBlocked(false)} className="text-xs text-primary px-3 py-2">← Quay lại</button>
              {blockedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Chưa chặn ai</p>
              ) : (
                <div className="space-y-2 px-2 pb-2">
                  {blockedUsers.map(uid => {
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
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsDialog;
