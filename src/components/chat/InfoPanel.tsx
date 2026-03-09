import React, { useState } from 'react';
import { X, Bell, Trash2, Users, Image, FileText, LogOut, UserPlus } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import ProfileViewDialog from './ProfileViewDialog';
import MediaGalleryDialog from './MediaGalleryDialog';
import TransferOwnerDialog from './TransferOwnerDialog';
import { motion, AnimatePresence } from 'framer-motion';

const InfoPanel: React.FC = () => {
  const { activeConversation, showInfoPanel, toggleInfoPanel, profiles, deleteConversation, leaveGroup, messages, friends, addMemberToGroup } = useChatContext();
  const { user } = useAuth();
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [galleryTab, setGalleryTab] = useState<'media' | 'files' | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

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

  const mediaCount = messages.filter(m => m.message_type === 'image' || m.message_type === 'video').length;
  const fileCount = messages.filter(m => m.message_type === 'file').length;

  const isOwner = user && activeConversation.members.find(m => m.user_id === user.id)?.role === 'owner';
  const isAdmin = user && activeConversation.members.find(m => m.user_id === user.id)?.role === 'admin';
  const otherMembers = activeConversation.members.filter(m => m.user_id !== user?.id).map(m => ({
    ...m,
    profile: profiles[m.user_id] || null,
  }));

  const currentMemberIds = activeConversation.members.map(m => m.user_id);
  const friendsNotInGroup = friends.filter(f => !currentMemberIds.includes(f.id));
  const filteredFriendsToAdd = friendsNotInGroup.filter(f =>
    f.display_name.toLowerCase().includes(addMemberSearch.toLowerCase()) ||
    f.username.toLowerCase().includes(addMemberSearch.toLowerCase())
  );

  const handleLeaveGroup = async () => {
    if (!activeConversation || activeConversation.type === 'private') return;
    if (isOwner && otherMembers.length > 0) {
      setShowTransferDialog(true);
      return;
    }
    if (window.confirm('Rời khỏi nhóm này? / Leave this group?')) {
      await leaveGroup(activeConversation.id);
    }
  };

  const handleTransferAndLeave = async (newOwnerId: string) => {
    await leaveGroup(activeConversation.id, newOwnerId);
  };

  const handleAddMember = async (userId: string) => {
    await addMemberToGroup(activeConversation.id, userId);
    setShowAddMember(false);
    setAddMemberSearch('');
  };

  return (
    <AnimatePresence>
      {showInfoPanel && (
        <>
          {/* Overlay to close on outside click */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30"
            onClick={toggleInfoPanel}
          />
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border bg-tg-sidebar h-full overflow-hidden flex-shrink-0 z-40 relative"
          >
          <div className="w-80 h-full flex flex-col overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Thông tin / Info</h3>
              <button onClick={toggleInfoPanel} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-col items-center py-6 px-4">
              <ChatAvatar name={getConvName()} online={getOtherOnline()} size="lg" />
              <h4 className="mt-3 font-semibold text-lg">{getConvName()}</h4>
              {activeConversation.type !== 'private' && (
                <p className="text-sm text-muted-foreground mt-1">{activeConversation.members.length} thành viên / members</p>
              )}
            </div>

            <div className="px-2 space-y-0.5">
              <InfoButton icon={Bell} label="Thông báo / Notifications" detail="Bật / On" />
              {activeConversation.type !== 'private' && (
                <InfoButton icon={Users} label="Thành viên / Members" detail={`${activeConversation.members.length}`} />
              )}
              <InfoButton icon={Image} label="Ảnh & Video / Media" detail={`${mediaCount}`} onClick={() => setGalleryTab('media')} />
              <InfoButton icon={FileText} label="Tệp / Files" detail={`${fileCount}`} onClick={() => setGalleryTab('files')} />
            </div>

            {activeConversation.type !== 'private' && (
              <div className="mt-4 px-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thành viên / Members</h5>
                  {(isOwner || isAdmin) && (
                    <button
                      onClick={() => setShowAddMember(!showAddMember)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      <UserPlus className="h-3 w-3" />
                      Thêm / Add
                    </button>
                  )}
                </div>

                {/* Add member panel */}
                <AnimatePresence>
                  {showAddMember && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-3"
                    >
                      <input
                        type="text"
                        value={addMemberSearch}
                        onChange={e => setAddMemberSearch(e.target.value)}
                        placeholder="Tìm bạn bè / Search friends..."
                        className="w-full bg-secondary rounded-xl px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 mb-2"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredFriendsToAdd.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            {friendsNotInGroup.length === 0 ? 'Tất cả bạn bè đã trong nhóm / All friends are in the group' : 'Không tìm thấy / Not found'}
                          </p>
                        ) : (
                          filteredFriendsToAdd.map(f => (
                            <button
                              key={f.id}
                              onClick={() => handleAddMember(f.id)}
                              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-tg-hover transition-colors"
                            >
                              <ChatAvatar name={f.display_name} online={f.online ?? false} size="sm" />
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-xs font-medium truncate">{f.display_name}</p>
                                <p className="text-[10px] text-muted-foreground">@{f.username}</p>
                              </div>
                              <UserPlus className="h-3.5 w-3.5 text-primary" />
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1">
                  {activeConversation.members.map(m => {
                    const p = profiles[m.user_id];
                    if (!p) return null;
                    return (
                      <div key={m.user_id} onClick={() => setViewProfileId(m.user_id)} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-tg-hover transition-colors cursor-pointer">
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

            <div className="mt-auto px-2 pb-4 pt-4 space-y-1">
              {activeConversation.type !== 'private' && (
                <button
                  onClick={handleLeaveGroup}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Rời nhóm / Leave group</span>
                </button>
              )}
              <button
                onClick={async () => {
                  if (window.confirm('Xoá cuộc trò chuyện này? / Delete this conversation?')) await deleteConversation(activeConversation.id);
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-sm"
              >
                <Trash2 className="h-4 w-4" />
                <span>{activeConversation.type === 'private' ? 'Xoá cuộc trò chuyện / Delete chat' : 'Xoá nhóm / Delete group'}</span>
              </button>
            </div>
          </div>
          {viewProfileId && <ProfileViewDialog userId={viewProfileId} onClose={() => setViewProfileId(null)} />}
          {galleryTab && <MediaGalleryDialog defaultTab={galleryTab} onClose={() => setGalleryTab(null)} />}
          {showTransferDialog && (
            <TransferOwnerDialog
              open={showTransferDialog}
              onClose={() => setShowTransferDialog(false)}
              members={otherMembers}
              onTransferAndLeave={handleTransferAndLeave}
            />
          )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const InfoButton: React.FC<{ icon: React.ElementType; label: string; detail: string; onClick?: () => void }> = ({ icon: Icon, label, detail, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-tg-hover transition-colors text-sm">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="flex-1 text-left">{label}</span>
    <span className="text-muted-foreground text-xs">{detail}</span>
  </button>
);

export default InfoPanel;
