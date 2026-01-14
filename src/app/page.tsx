"use client";
import { useEffect, useRef, useState } from 'react';

export default function VideoPage() {
  const currentCall = useRef<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerInstance = useRef<any>(null);

  useEffect(() => {
    import('peerjs').then(({ default: Peer }) => {
      const peer = new Peer(); // new id on new tab

      peer.on('open', (id) => setPeerId(id));

      peer.on('call', (call) => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
          localVideoRef.current!.srcObject = stream;
          call.answer(stream);
          // SAVE CALL REF
          currentCall.current = call;
          setIsCalling(true);
          call.on('stream', (remoteStream) => {
            remoteVideoRef.current!.srcObject = remoteStream;
          });
        });
      });

      peerInstance.current = peer;
    });
  }, []);

  const callUser = (id: string) => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localVideoRef.current!.srcObject = stream;
      const call = peerInstance.current.call(id, stream);
      currentCall.current = call;
      setIsCalling(true);
      call.on('stream', (remoteStream: MediaStream) => {
        remoteVideoRef.current!.srcObject = remoteStream;
      });
    });
  };

  const endCall = () => {
    // close the PeerJS call connection
    if (currentCall.current) {
      currentCall.current.close();
    }
    // also close the camera and mic
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIsCalling(false);
  };
  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Remote Video (Main) */}
      <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          className="w-full h-full object-cover"
        />

      </div>

      {/* Local Video (PiP) */}
      <div className={`absolute bottom-8 right-8 transition-all duration-700 overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl z-20 ${isCalling ? 'w-48 sm:w-72 aspect-video translate-y-0 opacity-100' : 'w-0 h-0 translate-y-10 opacity-0'}`}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="w-full h-full object-cover bg-zinc-800"
        />
        <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-white/70">
          You
        </div>
      </div>

      {/* Top Info Bar */}
      <div className="absolute top-8 left-8 p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 flex flex-col gap-1 z-30 group hover:bg-black/60 transition-all">
        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Your Identity</span>
        <div className="flex items-center gap-3">
          <code className="text-sm font-mono text-blue-400">{peerId || 'Generating ID...'}</code>
          {peerId && (
            <button
              onClick={() => navigator.clipboard.writeText(peerId)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Copy ID"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Middle Setup UI (Only visible when not calling) */}
      {!isCalling && (
        <div className="relative z-10 p-10 rounded-[2.5rem] bg-zinc-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col gap-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">EasyConnect</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">Secure, peer-to-peer video collaboration for your team. Just share your ID and start talking.</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-12 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="Enter Remote Peer ID"
                onChange={(e) => setRemotePeerId(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" /></svg>
            </div>
            <button
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold p-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3"
              onClick={() => callUser(remotePeerId)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              <span>Start Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls Bar (Visible during call) */}
      {isCalling && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-4 px-8 rounded-[2rem] bg-black/80 backdrop-blur-2xl border border-white/10 shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center gap-3 pr-6 border-r border-white/10">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase text-white/80">Live</span>
          </div>

          <button
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-90 shadow-xl shadow-red-500/20 group"
            onClick={endCall}
            title="End Call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-[135deg] group-hover:scale-110 transition-transform"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}