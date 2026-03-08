import React from 'react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import MessageArea from '@/components/chat/MessageArea';
import InfoPanel from '@/components/chat/InfoPanel';
import { ChatProvider, useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ChatLayout: React.FC = () => {
  const { isMobileShowingChat } = useChatContext();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      {/* Sidebar: always visible on md+, toggle on mobile */}
      <div className={cn(
        'h-full flex-shrink-0 border-r border-border',
        'w-full md:w-80',
        isMobileShowingChat ? 'hidden md:block' : 'block'
      )}>
        <ChatSidebar />
      </div>
      {/* Chat area: always visible on md+, toggle on mobile */}
      <div className={cn(
        'flex-1 h-full min-w-0',
        isMobileShowingChat ? 'block' : 'hidden md:block'
      )}>
        <MessageArea />
      </div>
      <InfoPanel />
    </div>
  );
};

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  );
};

export default Index;
