import React, { useState } from 'react';
import { X, Users, MessageCircle, UserPlus, Check, Clock } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface NewChatDialogProps {
  onClose: () => void;
}

const NewChatDialog: React.FC<NewChatDialogProps> = ({ onClose }) => {
  const { allProfiles, createPrivateChat, createGroup, setActiveConversation, friends, getFriendshipWith, sendFriendRequest, pendingRequests, acceptFriendRequest, declineFriendRequest } = useChatContext();
  const { user } = useAuth();
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const otherProfiles = allProfiles.filter(p => p.id !== user?.id && !p.is_bot);

  // Friends list filtered by search
  const filteredFriends = friends.filter(p =>
    p.display_name.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );


  const handlePrivateChat = async (userId: string) => {
    const convId = await createPrivateChat(userId);
    if (convId) {
      setActiveConversation(convId);
      onClose();
    } else {
      toast.error('Không thể tạo cuộc trò chuyện / Cannot create conversation');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm / Please enter group name');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 thành viên / Select at least 1 member');
      return;
    }
    const convId = await createGroup(groupName, selectedMembers);
    if (convId) {
      setActiveConversation(convId);
      onClose();
      toast.success('Tạo nhóm thành công! / Group created!');
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getFriendStatus = (userId: string) => {
    const fs = getFriendshipWith(userId);
    if (!fs) return 'none';
    if (fs.status === 'accepted') return 'friend';
    if (fs.status === 'pending' && fs.requester_id === user?.id) return 'sent';
    if (fs.status === 'pending' && fs.addressee_id === user?.id) return 'received';
    return 'none';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold font-display">Cuộc trò chuyện mới / New Chat</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          <button
            onClick={() => setTab('private')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'private' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover text-muted-foreground'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Bạn bè / Friends
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'group' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover text-muted-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Tạo nhóm / Group
          </button>
        </div>

        {/* Pending friend requests */}
        {tab === 'private' && pendingRequests.length > 0 && (
          <div className="px-4 pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Lời mời kết bạn / Friend Requests ({pendingRequests.length})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {pendingRequests.map(req => {
                const p = allProfiles.find(pr => pr.id === req.requester_id);
                if (!p) return null;
                return (
                  <div key={req.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                    <ChatAvatar name={p.display_name} online={p.online ?? false} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                    <button
                      onClick={() => acceptFriendRequest(req.id)}
                      className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      title="Chấp nhận / Accept"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => declineFriendRequest(req.id)}
                      className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      title="Từ chối / Decline"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Group name input */}
        {tab === 'group' && (
          <div className="px-4 pt-3">
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Tên nhóm / Group name..."
              className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'search' ? "Tìm người dùng / Search users..." : "Tìm bạn bè / Search friends..."}
            className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
          {tab === 'private' && (
            <>
              {filteredFriends.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm">Chưa có bạn bè / No friends yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Dùng tab "Tìm kiếm" để tìm và kết bạn / Use "Search" tab to find and add friends</p>
                </div>
              ) : (
                filteredFriends.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePrivateChat(p.id)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors hover:bg-tg-hover"
                  >
                    <ChatAvatar name={p.display_name} online={p.online ?? false} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                  </button>
                ))
              )}
            </>
          )}

          {tab === 'group' && (
            <>
              {filteredFriends.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">Chưa có bạn bè / No friends yet</p>
              ) : (
                filteredFriends.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleMember(p.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors ${
                      selectedMembers.includes(p.id) ? 'bg-primary/10' : 'hover:bg-tg-hover'
                    }`}
                  >
                    <ChatAvatar name={p.display_name} online={p.online ?? false} size="sm" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">@{p.username}</p>
                    </div>
                    {selectedMembers.includes(p.id) && (
                      <span className="text-primary text-sm">✓</span>
                    )}
                  </button>
                ))
              )}
            </>
          )}

          {tab === 'search' && (
            <>
              {filteredAll.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">Không tìm thấy / Not found</p>
              ) : (
                filteredAll.map(p => {
                  const status = getFriendStatus(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors hover:bg-tg-hover"
                    >
                      <ChatAvatar name={p.display_name} online={p.online ?? false} size="sm" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'none' && (
                          <button
                            onClick={() => sendFriendRequest(p.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                            title="Kết bạn / Add friend"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Kết bạn
                          </button>
                        )}
                        {status === 'sent' && (
                          <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs">
                            <Clock className="h-3.5 w-3.5" />
                            Đã gửi / Sent
                          </span>
                        )}
                        {status === 'received' && (
                          <button
                            onClick={() => {
                              const fs = getFriendshipWith(p.id);
                              if (fs) acceptFriendRequest(fs.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Chấp nhận / Accept
                          </button>
                        )}
                        {status === 'friend' && (
                          <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs">
                            <Check className="h-3.5 w-3.5" />
                            Bạn bè / Friends
                          </span>
                        )}
                        <button
                          onClick={() => handlePrivateChat(p.id)}
                          className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors"
                          title="Nhắn tin / Message"
                        >
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Group create button */}
        {tab === 'group' && (
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={handleCreateGroup}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Tạo nhóm / Create group ({selectedMembers.length} thành viên / members)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default NewChatDialog;
