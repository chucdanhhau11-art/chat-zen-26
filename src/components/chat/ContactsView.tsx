import React, { useState } from 'react';
import { Search, UserPlus, MessageCircle, UserMinus, Check, XCircle, Eye } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import ProfileViewDialog from './ProfileViewDialog';
import { cn } from '@/lib/utils';

const ContactsView: React.FC = () => {
  const { friends, profiles, pendingRequests, acceptFriendRequest, declineFriendRequest, removeFriend, getFriendshipWith, createPrivateChat, setActiveConversation, allProfiles, sendFriendRequest, cancelFriendRequest, isBlocked, isBlockedBy } = useChatContext();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const handleChat = async (userId: string) => {
    const convId = await createPrivateChat(userId);
    if (convId) setActiveConversation(convId);
  };

  const filteredFriends = friends.filter(f =>
    f.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Received pending requests
  const received = pendingRequests.filter(r => r.addressee_id === user?.id);
  // Sent pending requests
  const sent = pendingRequests.filter(r => r.requester_id === user?.id);

  // Global user search
  const searchedUsers = tab === 'search' && searchQuery.trim().length >= 2
    ? allProfiles.filter(p => {
        if (p.id === user?.id || p.is_bot) return false;
        if (isBlocked(p.id) || isBlockedBy(p.id)) return false;
        const q = searchQuery.toLowerCase();
        return p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
      })
    : [];

  return (
    <div className="flex flex-col h-full bg-tg-sidebar">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display font-semibold text-lg mb-3">Danh bạ</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-secondary rounded-xl pl-9 pr-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        <div className="flex gap-1 mb-2">
          {(['friends', 'requests', 'search'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-tg-hover'
              )}
            >
              {t === 'friends' ? `Bạn bè (${friends.length})` : t === 'requests' ? `Lời mời (${received.length})` : 'Tìm người dùng'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        {tab === 'friends' && (
          filteredFriends.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {searchQuery ? 'Không tìm thấy' : 'Chưa có bạn bè'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFriends.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-tg-hover transition-colors">
                  <ChatAvatar name={f.display_name} online={f.online ?? false} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{f.username}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleChat(f.id)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Nhắn tin">
                      <MessageCircle className="h-4 w-4 text-primary" />
                    </button>
                    <button onClick={() => setViewProfileId(f.id)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Xem profile">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'requests' && (
          <div className="space-y-1">
            {received.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Đã nhận</p>
                {received.map(r => {
                  const p = profiles[r.requester_id];
                  if (!p) return null;
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-tg-hover transition-colors">
                      <ChatAvatar name={p.display_name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => acceptFriendRequest(r.id)} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => declineFriendRequest(r.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {sent.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-2">Đã gửi</p>
                {sent.map(r => {
                  const p = profiles[r.addressee_id];
                  if (!p) return null;
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-tg-hover transition-colors">
                      <ChatAvatar name={p.display_name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </div>
                      <button onClick={() => cancelFriendRequest(r.id)} className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-destructive/10 hover:text-destructive transition-colors">
                        Huỷ
                      </button>
                    </div>
                  );
                })}
              </>
            )}
            {received.length === 0 && sent.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Không có lời mời</div>
            )}
          </div>
        )}

        {tab === 'search' && (
          searchQuery.trim().length < 2 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nhập ít nhất 2 ký tự để tìm kiếm</div>
          ) : searchedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Không tìm thấy</div>
          ) : (
            <div className="space-y-1">
              {searchedUsers.map(p => {
                const fs = getFriendshipWith(p.id);
                const status = !fs ? 'none' : fs.status === 'accepted' ? 'friend' : fs.requester_id === user?.id ? 'sent' : 'received';
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-tg-hover transition-colors">
                    <ChatAvatar name={p.display_name} online={p.online ?? false} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === 'none' && (
                        <button onClick={() => sendFriendRequest(p.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90">
                          <UserPlus className="h-3 w-3" /> Kết bạn
                        </button>
                      )}
                      {status === 'sent' && (
                        <button onClick={() => { if (fs) cancelFriendRequest(fs.id); }} className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-[11px]">
                          Đã gửi
                        </button>
                      )}
                      {status === 'received' && (
                        <button onClick={() => { if (fs) acceptFriendRequest(fs.id); }} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium">
                          <Check className="h-3 w-3" /> Chấp nhận
                        </button>
                      )}
                      {status === 'friend' && (
                        <span className="text-[11px] text-primary font-medium px-2 py-1">✓ Bạn bè</span>
                      )}
                      <button onClick={() => handleChat(p.id)} className="p-1.5 rounded-lg hover:bg-secondary" title="Nhắn tin">
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {viewProfileId && <ProfileViewDialog userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
    </div>
  );
};

export default ContactsView;
