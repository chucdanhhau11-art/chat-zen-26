import React, { useState } from 'react';
import { X, Users, MessageCircle } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatAvatar from './ChatAvatar';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface NewChatDialogProps {
  onClose: () => void;
}

const NewChatDialog: React.FC<NewChatDialogProps> = ({ onClose }) => {
  const { allProfiles, createPrivateChat, createGroup, setActiveConversation } = useChatContext();
  const { user } = useAuth();
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const otherProfiles = allProfiles.filter(p => p.id !== user?.id);
  const filtered = otherProfiles.filter(p =>
    p.display_name.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrivateChat = async (userId: string) => {
    const convId = await createPrivateChat(userId);
    if (convId) {
      setActiveConversation(convId);
      onClose();
    } else {
      toast.error('Không thể tạo cuộc trò chuyện');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }
    const convId = await createGroup(groupName, selectedMembers);
    if (convId) {
      setActiveConversation(convId);
      onClose();
      toast.success('Tạo nhóm thành công!');
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
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
          <h3 className="font-semibold font-display">Cuộc trò chuyện mới</h3>
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
            <MessageCircle className="h-3.5 w-3.5" /> Chat 1-1
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'group' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover text-muted-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Tạo nhóm
          </button>
        </div>

        {/* Group name input */}
        {tab === 'group' && (
          <div className="px-4 pt-3">
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Tên nhóm..."
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
            placeholder="Tìm người dùng..."
            className="w-full bg-secondary rounded-xl px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Không tìm thấy người dùng</p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                onClick={() => tab === 'private' ? handlePrivateChat(p.id) : toggleMember(p.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors ${
                  selectedMembers.includes(p.id) ? 'bg-primary/10' : 'hover:bg-tg-hover'
                }`}
              >
                <ChatAvatar name={p.display_name} online={p.online ?? false} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{p.username}</p>
                </div>
                {tab === 'group' && selectedMembers.includes(p.id) && (
                  <span className="text-primary text-sm">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Group create button */}
        {tab === 'group' && (
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={handleCreateGroup}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Tạo nhóm ({selectedMembers.length} thành viên)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default NewChatDialog;
