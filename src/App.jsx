import { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';

function App() {
  const [peerConnection, setPeerConnection] = useState(null);
  const [signalRConnection, setSignalRConnection] = useState(null);
  const [localSDP, setLocalSDP] = useState("");
  const [remoteSDP, setRemoteSDP] = useState("");
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [dataChannel, setDataChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:turn.onox.pro:3478',
      ],
      username: 'octopus',
      credential: 'octopus'
    }
  ];

  useEffect(() => {
    const connectSignalR = async () => {
      const connection = new HubConnectionBuilder()
        .withUrl('https://api.maxcloudphone.com/deviceHub')
        .withAutomaticReconnect()
        .build();

      connection.on('ReceiveSignal', async (signalData) => {
        const signal = JSON.parse(signalData);
        if (signal.type === 'offer') {
          await handleOffer(signal.sdp);
        } else if (signal.type === 'answer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'candidate') {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      });

      await connection.start();
      setSignalRConnection(connection);
    };

    connectSignalR();
  }, []);

  const initializeBroadcaster = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsBroadcaster(true);

      const pc = new RTCPeerConnection({ iceServers });

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && signalRConnection) {
          signalRConnection.invoke("SendSignal", JSON.stringify(event.candidate));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setLocalSDP(JSON.stringify(offer));

      if (signalRConnection) {
        signalRConnection.invoke("SendSignal", JSON.stringify(offer));
      }

      setPeerConnection(pc);
    } catch (error) {
      console.error("Error initializing broadcaster:", error);
    }
  };

  const initializeViewer = async () => {
    try {
      const pc = new RTCPeerConnection({ iceServers });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && signalRConnection) {
          signalRConnection.invoke("SendSignal", JSON.stringify(event.candidate));
        }
      };

      setPeerConnection(pc);
      setIsBroadcaster(false);
    } catch (error) {
      console.error("Error initializing viewer:", error);
    }
  };

  const handleOffer = async (offerSdp) => {
    if (!peerConnection) {
      console.log('No peer connection available, reinitializing...');
      initializePeerConnection();
      return;
    }

    try {
      console.log('Processing offer...');
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      signalRConnection?.invoke('SendSignal', JSON.stringify({
        type: 'answer',
        sdp: answer
      }));
      console.log('Answer sent successfully');
    } catch (error) {
      console.log(`Error handling offer: ${error}`);
    }
  };

  const sendMessage = () => {
    if (!dataChannel || !currentMessage || dataChannel.readyState !== 'open') {
      console.log(`Cannot send message - channel state: ${dataChannel?.readyState}`);
      return;
    }

    console.log(`Sending message: ${currentMessage}`);
    dataChannel.send(currentMessage);
    setMessages(prev => [...prev, { text: currentMessage, received: false }]);
    setCurrentMessage('');
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>WebRTC Chat V2</h1>
      
      <div>
        <button onClick={initializeBroadcaster}>Initialize as Broadcaster</button>
        <button onClick={initializeViewer}>Initialize as Viewer</button>
      </div>

      {isBroadcaster ? (
        <div style={{ marginTop: "20px" }}>
          <h3>Broadcaster View</h3>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "300px" }} />
        </div>
      ) : (
        <div style={{ marginTop: "20px" }}>
          <h3>Viewer View</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "300px" }} />
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <h3>Connection Setup</h3>
        <textarea value={localSDP} readOnly placeholder="Local SDP" style={{ width: "100%", height: "100px" }} />
        <textarea value={remoteSDP} onChange={(e) => setRemoteSDP(e.target.value)} placeholder="Remote SDP" style={{ width: "100%", height: "100px" }} />
        <button onClick={handleOffer}>Set Remote Description</button>
      </div>
    </div>
  );
}

export default App;
