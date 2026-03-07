import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import { motion } from 'framer-motion';

const MediaGalleryDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { messages } = useChatContext();
  const [tab, setTab] = useState<'media' | 'files'>('media');

  const mediaMessages = messages.filter(m => m.message_type === 'image' || m.message_type === 'video');
  const fileMessages = messages.filter(m => m.message_type === 'file');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold">Ảnh & File đã gửi</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-3">
          <button onClick={() => setTab('media')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'media' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover text-muted-foreground'}`}>
            Ảnh & Video ({mediaMessages.length})
          </button>
          <button onClick={() => setTab('files')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'files' ? 'bg-primary text-primary-foreground' : 'hover:bg-tg-hover text-muted-foreground'}`}>
            File ({fileMessages.length})
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {tab === 'media' ? (
            mediaMessages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Chưa có ảnh hay video nào</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {mediaMessages.map(m => (
                  <div key={m.id} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(m.file_url || '', '_blank')}>
                    {m.message_type === 'image' ? (
                      <img src={m.file_url || ''} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={m.file_url || ''} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            fileMessages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Chưa có file nào</p>
            ) : (
              <div className="space-y-2">
                {fileMessages.map(m => (
                  <a key={m.id} href={m.file_url || ''} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                    <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.file_name || 'file'}</p>
                      {m.file_size && <p className="text-[10px] text-muted-foreground">{(m.file_size / 1024).toFixed(1)} KB</p>}
                    </div>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MediaGalleryDialog;
