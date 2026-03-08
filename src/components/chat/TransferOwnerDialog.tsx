import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ChatAvatar from './ChatAvatar';

interface Member {
  user_id: string;
  profile?: { display_name: string; avatar_url: string | null; username: string } | null;
}

interface TransferOwnerDialogProps {
  open: boolean;
  onClose: () => void;
  members: Member[];
  onTransferAndLeave: (newOwnerId: string) => Promise<void>;
}

const TransferOwnerDialog: React.FC<TransferOwnerDialogProps> = ({ open, onClose, members, onTransferAndLeave }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    await onTransferAndLeave(selected);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chuyển quyền nhóm trưởng</DialogTitle>
          <DialogDescription>Bạn là nhóm trưởng. Hãy chọn thành viên để chuyển quyền trước khi rời nhóm.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {members.map(m => (
            <button
              key={m.user_id}
              onClick={() => setSelected(m.user_id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-sm ${
                selected === m.user_id ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-muted'
              }`}
            >
              <ChatAvatar
                name={m.profile?.display_name || 'User'}
                avatar={m.profile?.avatar_url || undefined}
                size="sm"
              />
              <span className="font-medium">{m.profile?.display_name || 'User'}</span>
              <span className="text-muted-foreground text-xs">@{m.profile?.username || '?'}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Huỷ</Button>
          <Button onClick={handleConfirm} disabled={!selected || loading}>
            {loading ? 'Đang xử lý...' : 'Chuyển & Rời nhóm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferOwnerDialog;
