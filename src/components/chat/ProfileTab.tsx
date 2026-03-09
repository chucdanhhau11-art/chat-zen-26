import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChatContext } from '@/context/ChatContext';
import ChatAvatar from './ChatAvatar';
import EditProfileDialog from './EditProfileDialog';

const ProfileTab: React.FC = () => {
  const { user, profile } = useAuth();
  const { profiles } = useChatContext();
  const [showEdit, setShowEdit] = useState(false);

  const p = profiles[user?.id || ''] || profile;

  return (
    <div className="flex flex-col h-full bg-tg-sidebar">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display font-semibold text-lg mb-3">Hồ sơ</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex flex-col items-center px-6 py-8">
          <ChatAvatar name={p?.display_name || 'U'} online={true} size="lg" />
          <h3 className="font-display font-semibold text-lg mt-4">{p?.display_name || 'User'}</h3>
          <p className="text-sm text-muted-foreground">@{p?.username}</p>
          {p?.bio && <p className="text-sm text-muted-foreground mt-2 text-center">{p.bio}</p>}
          {(p as any)?.phone_number && (
            <p className="text-sm text-muted-foreground mt-1">📞 {(p as any).phone_number}</p>
          )}
          <button
            onClick={() => setShowEdit(true)}
            className="mt-6 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Edit2 className="h-4 w-4" /> Chỉnh sửa
          </button>
        </div>
      </div>
      {showEdit && <EditProfileDialog onClose={() => setShowEdit(false)} />}
    </div>
  );
};

export default ProfileTab;
