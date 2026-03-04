import React from 'react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import MessageArea from '@/components/chat/MessageArea';
import InfoPanel from '@/components/chat/InfoPanel';
import { ChatProvider, useChatContext } from '@/context/ChatContext';

const ChatLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 h-full">
        <ChatSidebar />
      </div>

      {/* Message Area */}
      <MessageArea />

      {/* Info Panel */}
      <InfoPanel />
    </div>
  );
};

const Index = () => {
  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  );
};

export default Index;
