import React, { useState } from 'react';
import { X, Search, MessageCircle, Eye, Check, XCircle, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import ProfileViewDialog from './ProfileViewDialog';
import { formatUsername } from '@/lib/chatUtils';

interface ContactsDialogProps {
  onClose: () => void;
}

const ContactsDialog: React.FC<ContactsDialogProps> = ({ onClose }) => {
  const { friends, profiles, pendingRequests, acceptFriendRequest, declineFriendRequest, createPrivateChat, setActiveConversation } = useChatContext();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  const received = pendingRequests.filter(r => r.addressee_id === user?.id);

  const filtered = friends.filter(f =>
    f.display_name.toLowerCase().includes(search.toLowerCase()) ||
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleChat = async (userId: string) => {
    const convId = await createPrivateChat(userId);
    if (convId) {
      setActiveConversation(convId);
      onClose();
    }
  };

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
            <Users className="h-4 w-4 text-primary" /> Danh bạ ({friends.length})
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {received.length > 0 && (
          <div className="px-4 pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Lời mời đang chờ ({received.length})
            </p>
            <div className="rounded-xl border border-border overflow-hidden max-h-40 overflow-y-auto scrollbar-thin">
              <table className="w-full text-sm">
                <tbody>
                  {received.map(r => {
                    const p = profiles[r.requester_id];
                    if (!p) return null;
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ChatAvatar name={p.display_name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{p.display_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{formatUsername(p.username)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button onClick={() => acceptFriendRequest(r.id)} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mr-1">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => declineFriendRequest(r.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm bạn bè..."
              className="w-full bg-secondary rounded-xl pl-9 pr-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">
              {search ? 'Không tìm thấy' : 'Chưa có bạn bè'}
            </p>
          ) : (
            filtered.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-tg-hover transition-colors">
                <ChatAvatar name={f.display_name} online={f.online ?? false} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{formatUsername(f.username)}</p>
                </div>
                <button onClick={() => handleChat(f.id)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Nhắn tin">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </button>
                <button onClick={() => setViewProfileId(f.id)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Xem profile">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {viewProfileId && <ProfileViewDialog userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
    </div>
  );
};

export default ContactsDialog;
