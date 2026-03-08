import { useRef, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export type CallState = 'idle' | 'calling' | 'receiving' | 'connected';
export type CallType = 'voice' | 'video';

interface UseWebRTCOptions {
  userId: string;
  onIncomingCall?: (callerId: string, callerName: string, callType: CallType) => void;
}

export const useWebRTC = ({ userId, onIncomingCall }: UseWebRTCOptions) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('voice');
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringtoneRef.current = ctx;
      const playTone = () => {
        if (!ringtoneRef.current) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      };
      playTone();
      ringtoneIntervalRef.current = setInterval(playTone, 1500);
    } catch {}
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (ringtoneRef.current) {
      ringtoneRef.current.close().catch(() => {});
      ringtoneRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopCallTimer();
    stopRingtone();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = new MediaStream();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCallState('idle');
    setRemoteUserId(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
  }, [stopCallTimer, stopRingtone]);

  const getSignalingChannel = useCallback((peerId: string) => {
    const roomId = [userId, peerId].sort().join('-');
    const channel = supabase.channel(`call:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    return channel;
  }, [userId]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach(track => {
        remoteStreamRef.current.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, []);

  const startCall = useCallback(async (peerId: string, type: CallType) => {
    try {
      setCallType(type);
      setRemoteUserId(peerId);
      setCallState('calling');
      playRingtone();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const channel = getSignalingChannel(peerId);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate, from: userId } });
        }
      };

      channel.on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (payload.from !== peerId) return;
        stopRingtone();
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        setCallState('connected');
        startCallTimer();
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from !== peerId) return;
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      });

      channel.on('broadcast', { event: 'call-end' }, ({ payload }) => {
        if (payload.from !== peerId) return;
        cleanup();
      });

      channel.on('broadcast', { event: 'call-rejected' }, ({ payload }) => {
        if (payload.from !== peerId) return;
        cleanup();
      });

      await channel.subscribe();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channel.send({
        type: 'broadcast',
        event: 'call-offer',
        payload: { offer, from: userId, callType: type },
      });
    } catch (err: any) {
      console.error('Start call error:', err);
      cleanup();
    }
  }, [userId, createPeerConnection, getSignalingChannel, startCallTimer, playRingtone, stopRingtone, cleanup]);

  const answerCall = useCallback(async () => {
    if (!remoteUserId) return;
    try {
      stopRingtone();
      const type = callType;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = pcRef.current;
      if (!pc) return;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'call-answer',
        payload: { answer, from: userId },
      });

      setCallState('connected');
      startCallTimer();
    } catch (err: any) {
      console.error('Answer call error:', err);
      cleanup();
    }
  }, [remoteUserId, callType, userId, startCallTimer, stopRingtone, cleanup]);

  const rejectCall = useCallback(() => {
    if (remoteUserId && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-rejected',
        payload: { from: userId },
      });
    }
    cleanup();
  }, [remoteUserId, userId, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUserId && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { from: userId },
      });
    }
    cleanup();
  }, [remoteUserId, userId, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    // Subscribe to a personal channel for receiving calls
    const personalChannel = supabase.channel(`user-calls:${userId}`, {
      config: { broadcast: { self: false } },
    });

    personalChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      if (callState !== 'idle') return; // already in a call
      const { from, callerName, callType: ct } = payload;
      setRemoteUserId(from);
      setCallType(ct);
      setCallState('receiving');
      playRingtone();

      // Set up signaling channel for receiver
      const channel = getSignalingChannel(from);
      const pc = createPeerConnection();

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate, from: userId } });
        }
      };

      channel.on('broadcast', { event: 'call-offer' }, async ({ payload: offerPayload }) => {
        if (offerPayload.from !== from) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offerPayload.offer));
        } catch {}
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload: icePayload }) => {
        if (icePayload.from !== from) return;
        try { await pc.addIceCandidate(new RTCIceCandidate(icePayload.candidate)); } catch {}
      });

      channel.on('broadcast', { event: 'call-end' }, ({ payload: endPayload }) => {
        if (endPayload.from !== from) return;
        cleanup();
      });

      channel.subscribe();

      onIncomingCall?.(from, callerName, ct);
    });

    personalChannel.subscribe();

    return () => {
      supabase.removeChannel(personalChannel);
    };
  }, [userId, callState, createPeerConnection, getSignalingChannel, playRingtone, cleanup, onIncomingCall]);

  // Notify callee about the call via their personal channel
  const notifyCallee = useCallback(async (peerId: string, callerName: string, type: CallType) => {
    const tempChannel = supabase.channel(`user-calls:${peerId}`, {
      config: { broadcast: { self: false } },
    });
    await tempChannel.subscribe();
    tempChannel.send({
      type: 'broadcast',
      event: 'incoming-call',
      payload: { from: userId, callerName, callType: type },
    });
    // Remove after sending
    setTimeout(() => supabase.removeChannel(tempChannel), 2000);
  }, [userId]);

  return {
    callState,
    callType,
    remoteUserId,
    isMuted,
    isVideoOff,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    remoteStream: remoteStreamRef.current,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    notifyCallee,
  };
};
