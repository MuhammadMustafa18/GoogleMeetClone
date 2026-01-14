"use client";
import { useEffect, useRef, useState } from 'react';
import {
  LuVideoOff,
  LuCopy,
  LuUserPlus,
  LuPhone,
  LuPhoneOff,
  LuMonitor,
  LuFileUp,
  LuX
} from 'react-icons/lu';

export default function VideoPage() {
  const currentCall = useRef<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [peerId, setPeerId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerInstance = useRef<any>(null);
  const dataConnRef = useRef<any>(null); // the data connection
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const [receivedFiles, setReceivedFiles] = useState<{ name: string, url: string }[]>([]);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const isBusyRef = useRef(false);
  const activePeerRef = useRef<string | null>(null);

  useEffect(() => {
    import('peerjs').then(({ default: Peer }) => {
      const peer = new Peer();

      peer.on('open', (id) => {
        setPeerId(id);
      });

      // handles when someone calls you
      peer.on('call', (call) => {
        if (isBusyRef.current && activePeerRef.current !== call.peer) {
          call.close();
          return;
        }
        isBusyRef.current = true;
        activePeerRef.current = call.peer;
        setIncomingCall(call);
      });

      // handles files and whiteboard data
      peer.on('connection', (conn) => {
        // only reject if we are busy AND it's a different person
        if (isBusyRef.current && activePeerRef.current !== conn.peer) {
          conn.on('open', () => {
            conn.send({ type: 'busy' });
            setTimeout(() => conn.close(), 1000);
          });
          return;
        }
        dataConnRef.current = conn;
        setupDataListeners(conn);
      });

      peerInstance.current = peer;
    });
  }, []);

  const setupDataListeners = (conn: any) => {
    conn.on('data', (data: any) => {
      if (data.type === 'busy') {
        alert("The user is currently in another call.");
        endCall();
      } else if (data.type === 'file') {
        const blob = new Blob([data.file], { type: data.fileType });
        const url = URL.createObjectURL(blob);
        setReceivedFiles(prev => [...prev, { name: data.fileName, url }]);
      } else if (data.type === 'draw') {
        drawOnCanvas(data.prevX, data.prevY, data.currX, data.currY, data.color, false);
      } else if (data.type === 'clear') {
        clearCanvas(false);
      }
    });

    conn.on('open', () => {
      console.log("Data connection established");
    });
  };

  const sendFile = (file: File) => {
    if (!dataConnRef.current) {
      if (!remotePeerId) return;
      dataConnRef.current = peerInstance.current.connect(remotePeerId);
      setupDataListeners(dataConnRef.current);
    }

    const send = () => {
      dataConnRef.current.send({
        type: 'file',
        file: file,
        fileName: file.name,
        fileType: file.type
      });
      alert("File sent successfully!");
    };

    if (dataConnRef.current.open) {
      send();
    } else {
      dataConnRef.current.on('open', send);
    }
  };

  const callUser = (id: string) => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localVideoRef.current!.srcObject = stream;
      const call = peerInstance.current.call(id, stream);
      currentCall.current = call;
      setIsCalling(true);
      isBusyRef.current = true;
      activePeerRef.current = id;

      // Also establish data connection manually when calling
      const conn = peerInstance.current.connect(id);
      dataConnRef.current = conn;
      setupDataListeners(conn);

      call.on('stream', (remoteStream: MediaStream) => {
        remoteVideoRef.current!.srcObject = remoteStream;
      });
    });
  };

  const answerCall = () => {
    if (!incomingCall) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localVideoRef.current!.srcObject = stream;
      incomingCall.answer(stream);
      currentCall.current = incomingCall;
      setIsCalling(true);
      isBusyRef.current = true;
      setIncomingCall(null);

      // Also establish data connection manually when answering
      const conn = peerInstance.current.connect(incomingCall.peer);
      dataConnRef.current = conn;
      setupDataListeners(conn);

      incomingCall.on('stream', (remoteStream: MediaStream) => {
        remoteVideoRef.current!.srcObject = remoteStream;
      });
    });
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.close();
      setIncomingCall(null);
      isBusyRef.current = false;
      activePeerRef.current = null;
    }
  };
  const switchScreenShare = async () => {
    try {
      // get the screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      // swap the video track
      const senders = currentCall.current?.peerConnection.getSenders();
      const videoSender = senders?.find((s: any) => s.track?.kind === 'video');

      if (videoSender) {
        videoSender.replaceTrack(screenTrack);
      }

      // show what you're sharing locally
      localVideoRef.current!.srcObject = screenStream;

      // go back to camera if they click "stop sharing" in the browser
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Could not share screen:", err);
    }
  };

  const stopScreenShare = async () => {
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const videoTrack = videoStream.getVideoTracks()[0];

    const senders = currentCall.current?.peerConnection.getSenders();
    const videoSender = senders?.find((s: any) => s.track?.kind === 'video');

    if (videoSender) {
      videoSender.replaceTrack(videoTrack);
    }

    localVideoRef.current!.srcObject = videoStream;
  };

  // Whiteboard Logic
  const drawOnCanvas = (prevX: number, prevY: number, currX: number, currY: number, color: string, emit: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
    ctx.closePath();

    if (emit && dataConnRef.current?.open) {
      dataConnRef.current.send({
        type: 'draw',
        prevX, prevY, currX, currY, color
      });
    }
  };

  const clearCanvas = (emit: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (emit && dataConnRef.current?.open) {
      dataConnRef.current.send({ type: 'clear' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    isDrawing.current = true;
    lastPos.current = { x, y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const currY = (e.clientY - rect.top) * (canvas.height / rect.height);
    drawOnCanvas(lastPos.current.x, lastPos.current.y, currX, currY, '#3b82f6', true);
    lastPos.current = { x: currX, y: currY };
  };

  const stopDrawing = () => {
    isDrawing.current = false;
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
    isBusyRef.current = false;
    activePeerRef.current = null;
  };
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans">
      {/* Background/Remote Video area */}
      <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          autoPlay
          className="w-full h-full object-cover"
        />
        {!isCalling && (
          <div className="text-zinc-500 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
              <LuVideoOff size={28} className="text-zinc-600" />
            </div>
            <p className="text-sm">No Active Connection</p>
          </div>
        )}
      </div>

      {/* Someone is calling you */}
      {incomingCall && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
              <LuPhone size={32} className="text-blue-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">Incoming Call</h2>
              <p className="text-zinc-500 text-xs font-mono truncate w-48 mx-auto">{incomingCall.peer}</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={answerCall}
                className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-semibold transition"
              >
                Accept
              </button>
              <button
                onClick={rejectCall}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-semibold transition"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Your own video (PiP) */}
      <div className={`absolute bottom-6 right-6 overflow-hidden rounded-xl border border-white/20 z-10 ${isCalling ? 'w-48 sm:w-64 aspect-video' : 'hidden'}`}>
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="w-full h-full object-cover bg-zinc-800"
        />
        <div className="absolute bottom-2 left-2 bg-black/40 px-2 py-0.5 rounded text-[10px] text-white">
          You
        </div>
      </div>

      {/* Your Peer ID info */}
      <div className="absolute top-6 left-6 p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-1 z-20">
        <span className="text-[10px] text-zinc-400 font-bold uppercase">Your ID</span>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-blue-400">{peerId || 'Loading...'}</code>
          {peerId && (
            <button
              onClick={() => navigator.clipboard.writeText(peerId)}
              className="p-1 hover:bg-white/10 rounded transition"
            >
              <LuCopy size={12} className="text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* Setup screen before call starts */}
      {!isCalling && (
        <div className="relative z-10 p-8 rounded-3xl bg-zinc-900 border border-white/10 flex flex-col gap-6 max-w-sm w-full mx-4">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">EasyConnect</h1>
            <p className="text-zinc-500 text-sm">Enter an ID below to start chatting.</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 pl-10 text-white focus:outline-none focus:border-blue-500 transition"
                placeholder="Paste remote ID here"
                onChange={(e) => setRemotePeerId(e.target.value)}
              />
              <LuUserPlus size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            </div>
            <button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold p-3 rounded-xl transition"
              onClick={() => callUser(remotePeerId)}
            >
              Start Call
            </button>
          </div>
        </div>
      )}

      {/* Whiteboard and file alerts */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-30">
        <button
          onClick={() => setShowWhiteboard(!showWhiteboard)}
          className={`px-4 py-2 rounded-lg border border-white/10 text-xs font-bold transition ${showWhiteboard ? 'bg-blue-600' : 'bg-black/40'}`}
        >
          {showWhiteboard ? 'Hide Board' : 'Show Board'}
        </button>
        {receivedFiles.map((file, i) => (
          <div key={i} className="bg-blue-600 p-3 rounded-lg border border-white/10 flex items-center gap-3">
            <span className="text-xs truncate w-24">{file.name}</span>
            <a href={file.url} download={file.name} className="bg-white text-blue-600 px-2 py-1 rounded text-[10px] font-bold">Save</a>
          </div>
        ))}
      </div>

      {/* The actual drawing board */}
      {showWhiteboard && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/30">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl aspect-video relative flex flex-col overflow-hidden">
            <div className="p-3 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-400">WHITEBOARD</span>
                <button onClick={() => clearCanvas(true)} className="text-[10px] text-red-400 hover:underline">Clear</button>
              </div>
              <button onClick={() => setShowWhiteboard(false)} className="p-1 hover:bg-white/10 rounded-full">
                <LuX size={16} className="text-zinc-500" />
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={1000}
              height={600}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="w-full h-full bg-white cursor-crosshair"
            />
          </div>
        </div>
      )}

      {/* Controls during the call */}
      {isCalling && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 px-6 rounded-full bg-zinc-900 border border-white/10 z-20">
          <div className="flex items-center gap-2 pr-4 border-r border-white/10">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold text-white/70">LIVE</span>
          </div>

          <button onClick={switchScreenShare} className="p-2 hover:bg-white/5 rounded-full" title="Screen Share">
            <LuMonitor size={18} />
          </button>

          <label className="p-2 hover:bg-white/5 rounded-full cursor-pointer" title="Send File">
            <LuFileUp size={18} />
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && sendFile(e.target.files[0])} />
          </label>

          <button onClick={endCall} className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center" title="End Call">
            <LuPhoneOff size={18} className="rotate-[135deg]" />
          </button>
        </div>
      )}
    </div>
  );
}