import React, { useEffect, useRef, useCallback, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface MiniAppDialogProps {
  url: string;
  botName: string;
  chatId?: string;
  botId?: string;
  onClose: () => void;
}

const MiniAppDialog: React.FC<MiniAppDialogProps> = ({ url, botName, chatId, botId, onClose }) => {
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Generate a simple auth token for the mini app
  const authToken = useRef(crypto.randomUUID());

  // Send context to the iframe via postMessage
  const sendContext = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      type: 'mini_app_context',
      data: {
        user_id: user?.id || null,
        username: user?.user_metadata?.username || null,
        chat_id: chatId || null,
        bot_id: botId || null,
        auth_token: authToken.current,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      },
    }, '*');
  }, [user, chatId, botId]);

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event.data?.type) return;

      switch (event.data.type) {
        case 'mini_app_ready':
          sendContext();
          break;
        case 'mini_app_close':
          onClose();
          break;
        case 'mini_app_send_message':
          if (event.data.text && chatId && user) {
            supabase.from('messages').insert({
              conversation_id: chatId,
              sender_id: user.id,
              content: event.data.text,
              message_type: 'text',
            });
            supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
          }
          break;
        case 'mini_app_expand':
          setExpanded(true);
          break;
        case 'mini_app_collapse':
          setExpanded(false);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendContext, onClose, chatId, user]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
            expanded 
              ? 'w-full h-full sm:w-[95vw] sm:h-[95vh]' 
              : 'w-full sm:w-[420px] h-[70vh] sm:h-[600px]'
          } transition-all duration-300`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-tg-sidebar">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate">{botName}</h3>
              <p className="text-[10px] text-muted-foreground truncate">{new URL(url).hostname}</p>
            </div>
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors"
              title={expanded ? 'Thu nhỏ' : 'Mở rộng'}
            >
              {expanded ? <Minimize2 className="h-4 w-4 text-muted-foreground" /> : <Maximize2 className="h-4 w-4 text-muted-foreground" />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-tg-hover transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Iframe */}
          <div className="flex-1 overflow-hidden">
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              allow="camera; microphone; geolocation; clipboard-write"
              onLoad={sendContext}
              title={`${botName} Mini App`}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MiniAppDialog;
