import React, { useCallback, useState } from 'react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import MessageArea from '@/components/chat/MessageArea';
import InfoPanel from '@/components/chat/InfoPanel';
import CallScreen from '@/components/chat/CallScreen';
import { ChatProvider, useChatContext } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWebRTC, type CallType } from '@/hooks/useWebRTC';
import { toast } from 'sonner';

const ChatLayout: React.FC = () => {
  const { isMobileShowingChat, activeConversation, profiles } = useChatContext();
  const { user } = useAuth();

  const handleIncomingCall = useCallback((callerId: string, callerName: string, callType: CallType) => {
    toast.info(`${callerName} đang gọi...`);
  }, []);

  const webrtc = useWebRTC({
    userId: user?.id || '',
    onIncomingCall: handleIncomingCall,
  });

  const getRemoteName = () => {
    if (webrtc.remoteUserId && profiles[webrtc.remoteUserId]) {
      return profiles[webrtc.remoteUserId].display_name;
    }
    return 'Unknown';
  };

  const getRemoteAvatar = () => {
    if (webrtc.remoteUserId && profiles[webrtc.remoteUserId]) {
      return profiles[webrtc.remoteUserId].avatar_url;
    }
    return null;
  };

  const handleStartCall = useCallback(async (type: CallType) => {
    if (!activeConversation || !user) return;
    if (activeConversation.type !== 'private') {
      toast.error('Chỉ hỗ trợ gọi trong chat riêng');
      return;
    }
    const other = activeConversation.members.find(m => m.user_id !== user.id);
    if (!other) return;
    const callerProfile = profiles[user.id];
    const callerName = callerProfile?.display_name || 'Unknown';
    await webrtc.notifyCallee(other.user_id, callerName, type);
    webrtc.startCall(other.user_id, type);
  }, [activeConversation, user, profiles, webrtc]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
      <div className={cn(
        'h-full flex-shrink-0 border-r border-border',
        'w-full md:w-80',
        isMobileShowingChat ? 'hidden md:block' : 'block'
      )}>
        <ChatSidebar />
      </div>
      <div className={cn(
        'flex-1 h-full min-w-0',
        isMobileShowingChat ? 'block' : 'hidden md:block'
      )}>
        <MessageArea onStartCall={handleStartCall} />
      </div>
      <InfoPanel />

      {/* Call overlay */}
      <CallScreen
        callState={webrtc.callState}
        callType={webrtc.callType}
        remoteName={getRemoteName()}
        remoteAvatarUrl={getRemoteAvatar()}
        callDuration={webrtc.callDuration}
        isMuted={webrtc.isMuted}
        isVideoOff={webrtc.isVideoOff}
        localVideoRef={webrtc.localVideoRef}
        remoteVideoRef={webrtc.remoteVideoRef}
        remoteStream={webrtc.remoteStream}
        onAnswer={webrtc.answerCall}
        onReject={webrtc.rejectCall}
        onEnd={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
      />
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
