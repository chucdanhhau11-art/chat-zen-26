import { useRef, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
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
  const [remoteStream, setRemoteStream] = useState<MediaStream>(() => new MediaStream());

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerResendRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const remoteUserIdRef = useRef<string | null>(null);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { remoteUserIdRef.current = remoteUserId; }, [remoteUserId]);

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;
    setRemoteStream(stream);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, []);

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const list = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of list) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  }, []);

  const addCandidate = useCallback(async (pc: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
    if (!pc.remoteDescription || !pc.remoteDescription.type) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
  }, []);

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
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

  const stopOfferResend = useCallback(() => {
    if (offerResendRef.current) {
      clearInterval(offerResendRef.current);
      offerResendRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopCallTimer();
    stopRingtone();
    stopOfferResend();
    pendingCandidatesRef.current = [];
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    const empty = new MediaStream();
    remoteStreamRef.current = empty;
    setRemoteStream(empty);
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCallState('idle');
    setRemoteUserId(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
  }, [stopCallTimer, stopRingtone, stopOfferResend]);

  const getSignalingChannel = useCallback((peerId: string) => {
    const roomId = [userId, peerId].sort().join('-');
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase.channel(`call:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    return channel;
  }, [userId]);

  const endCallRef = useRef<() => void>(() => {});

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        attachRemoteStream(stream);
      } else {
        remoteStreamRef.current.addTrack(event.track);
        attachRemoteStream(remoteStreamRef.current);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        endCallRef.current();
      }
    };

    return pc;
  }, [attachRemoteStream]);

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
          channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate.toJSON(), from: userId } });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sendOffer = () => {
        channel.send({
          type: 'broadcast',
          event: 'call-offer',
          payload: { offer: pc.localDescription, from: userId, callType: type },
        });
      };

      channel.on('broadcast', { event: 'callee-ready' }, ({ payload }) => {
        if (payload.from !== peerId) return;
        sendOffer();
      });

      channel.on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (payload.from !== peerId) return;
        if (pc.signalingState === 'stable') return;
        stopRingtone();
        stopOfferResend();
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushCandidates(pc);
        setCallState('connected');
        startCallTimer();
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from !== peerId) return;
        await addCandidate(pc, payload.candidate);
      });

      channel.on('broadcast', { event: 'call-end' }, ({ payload }) => {
        if (payload.from !== peerId) return;
        cleanup();
      });

      channel.on('broadcast', { event: 'call-rejected' }, ({ payload }) => {
        if (payload.from !== peerId) return;
        cleanup();
      });

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          sendOffer();
          // Re-send the offer until the callee answers (handles late subscription)
          stopOfferResend();
          offerResendRef.current = setInterval(sendOffer, 1500);
        }
      });
    } catch (err: any) {
      console.error('Start call error:', err);
      cleanup();
    }
  }, [userId, createPeerConnection, getSignalingChannel, startCallTimer, playRingtone, stopRingtone, stopOfferResend, cleanup, addCandidate, flushCandidates]);

  const answerCall = useCallback(async () => {
    const peerId = remoteUserIdRef.current;
    if (!peerId) return;
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

      // Wait until the offer arrives (up to 10s)
      const deadline = Date.now() + 10000;
      while (!pc.remoteDescription && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 150));
      }
      if (!pc.remoteDescription) {
        console.error('No offer received');
        cleanup();
        return;
      }

      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await flushCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'call-answer',
        payload: { answer: pc.localDescription, from: userId },
      });

      setCallState('connected');
      startCallTimer();
    } catch (err: any) {
      console.error('Answer call error:', err);
      cleanup();
    }
  }, [callType, userId, startCallTimer, stopRingtone, cleanup, flushCandidates]);

  const rejectCall = useCallback(() => {
    if (remoteUserIdRef.current && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-rejected',
        payload: { from: userId },
      });
    }
    cleanup();
  }, [userId, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUserIdRef.current && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-end',
        payload: { from: userId },
      });
    }
    cleanup();
  }, [userId, cleanup]);

  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

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

    const personalChannel = supabase.channel(`user-calls:${userId}`, {
      config: { broadcast: { self: false } },
    });

    personalChannel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      if (callStateRef.current !== 'idle') return; // already in a call
      const { from, callerName, callType: ct } = payload;
      setRemoteUserId(from);
      remoteUserIdRef.current = from;
      setCallType(ct);
      setCallState('receiving');
      callStateRef.current = 'receiving';
      playRingtone();

      // Set up signaling channel for receiver
      const channel = getSignalingChannel(from);
      const pc = createPeerConnection();

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate.toJSON(), from: userId } });
        }
      };

      channel.on('broadcast', { event: 'call-offer' }, async ({ payload: offerPayload }) => {
        if (offerPayload.from !== from) return;
        if (pc.remoteDescription) return; // already have the offer
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offerPayload.offer));
          await flushCandidates(pc);
        } catch (e) { console.error('setRemoteDescription failed', e); }
      });

      channel.on('broadcast', { event: 'ice-candidate' }, async ({ payload: icePayload }) => {
        if (icePayload.from !== from) return;
        await addCandidate(pc, icePayload.candidate);
      });

      channel.on('broadcast', { event: 'call-end' }, ({ payload: endPayload }) => {
        if (endPayload.from !== from) return;
        cleanup();
      });

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'callee-ready', payload: { from: userId } });
        }
      });

      onIncomingCall?.(from, callerName, ct);
    });

    personalChannel.subscribe();

    return () => {
      supabase.removeChannel(personalChannel);
    };
  }, [userId, createPeerConnection, getSignalingChannel, playRingtone, cleanup, onIncomingCall, addCandidate, flushCandidates]);

  // Notify callee about the call via their personal channel
  const notifyCallee = useCallback(async (peerId: string, callerName: string, type: CallType) => {
    const tempChannel = supabase.channel(`user-calls:${peerId}`, {
      config: { broadcast: { self: false } },
    });
    await new Promise<void>((resolve) => {
      tempChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
      setTimeout(resolve, 3000);
    });
    await tempChannel.send({
      type: 'broadcast',
      event: 'incoming-call',
      payload: { from: userId, callerName, callType: type },
    });
    setTimeout(() => supabase.removeChannel(tempChannel), 3000);
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
    remoteAudioRef,
    remoteStream,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    notifyCallee,
  };
};
