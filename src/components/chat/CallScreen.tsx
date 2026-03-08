import React, { useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CallState, CallType } from '@/hooks/useWebRTC';
import ChatAvatar from './ChatAvatar';

interface CallScreenProps {
  callState: CallState;
  callType: CallType;
  remoteName: string;
  remoteAvatarUrl?: string | null;
  callDuration: number;
  isMuted: boolean;
  isVideoOff: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  remoteStream: MediaStream;
  onAnswer: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const CallScreen: React.FC<CallScreenProps> = ({
  callState, callType, remoteName, remoteAvatarUrl,
  callDuration, isMuted, isVideoOff,
  localVideoRef, remoteVideoRef, remoteStream,
  onAnswer, onReject, onEnd, onToggleMute, onToggleVideo,
}) => {
  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoRef, callState]);

  if (callState === 'idle') return null;

  const isVideo = callType === 'video';
  const isReceiving = callState === 'receiving';
  const isCalling = callState === 'calling';
  const isConnected = callState === 'connected';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center"
      >
        {/* Video views */}
        {isVideo && isConnected && (
          <>
            {/* Remote video (full screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Local video (small PiP) */}
            <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          </>
        )}

        {/* Voice call / waiting screen */}
        {(!isVideo || !isConnected) && (
          <div className="flex flex-col items-center gap-4 z-10">
            <motion.div
              animate={isCalling || isReceiving ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <ChatAvatar name={remoteName} avatar={remoteAvatarUrl || undefined} size="lg" />
            </motion.div>
            <h2 className="text-white text-2xl font-semibold">{remoteName}</h2>
            <p className="text-white/60 text-sm">
              {isCalling && 'Đang gọi...'}
              {isReceiving && (isVideo ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...')}
              {isConnected && formatDuration(callDuration)}
            </p>
          </div>
        )}

        {/* Connected video overlay info */}
        {isVideo && isConnected && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {formatDuration(callDuration)}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-6 z-10">
          {/* Mute */}
          <button
            onClick={onToggleMute}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
              isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
            )}
          >
            {isMuted ? <MicOff className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
          </button>

          {/* Video toggle (only for video calls) */}
          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                isVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
              )}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6 text-white" /> : <Video className="h-6 w-6 text-white" />}
            </button>
          )}

          {/* Answer (only when receiving) */}
          {isReceiving && (
            <button
              onClick={onAnswer}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors animate-pulse"
            >
              <Phone className="h-7 w-7 text-white" />
            </button>
          )}

          {/* End / Reject */}
          <button
            onClick={isReceiving ? onReject : onEnd}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          >
            <PhoneOff className="h-7 w-7 text-white" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallScreen;
