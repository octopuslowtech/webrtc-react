import { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';

function App() {
  const peerConnectionRef = useRef(null);
  const signalRConnectionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);


  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:turn.onox.pro:3478',
      username: 'octopus',
      credential: '0559551321'
    },
    {
      urls: 'turn:relay1.expressturn.com:3478',
      username: 'efLDK4QL9WAH27Z6AJ',
      credential: 'E5AwlcaSDOiKwx4U'
    }
  ];

  useEffect(() => {
    initializePeerConnection();
    connectSignalR();
  }, []);

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Using ICE server:', event.candidate.address);
      }
      if (event.candidate && signalRConnectionRef.current && targetConnectionId) {
        signalRConnectionRef.current.invoke("SendSignal", targetConnectionId, JSON.stringify({
          type: 'candidate',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        }));


      } else {
        console.log('Kết thúc thu thập candidates');
      }
    };

    peerConnectionRef.current = pc;
  };

  const connectSignalR = async () => {
    const connection = new HubConnectionBuilder()
      .withUrl('https://api.maxcloudphone.com/deviceHub')
      .withAutomaticReconnect()
      .build();

    signalRConnectionRef.current = connection;

    connection.on('ReceiveSignal', async (senderConnectionId, signalData) => {
      console.log('Received signal from:', senderConnectionId + " - " + signalData);
      try {
        const signal = JSON.parse(signalData);
        if (signal.type === 'offer') {
          console.log("Received offer...");
          await handleOffer(signal, senderConnectionId);
        } else if (signal.type === 'answer') {
          console.log("Received answer...");
          await handleAnswer(signal.sdp);
        } else if (signal.type === 'candidate') {
          console.log("Received ICE candidate...");
          try {
            let candidate = new RTCIceCandidate({
              sdpMid: signal.sdpMid,
              sdpMLineIndex: signal.sdpMLineIndex,
              candidate: signal.candidate
            });

            await peerConnectionRef.current.addIceCandidate(candidate);
            console.log("Successfully added ICE candidate");
          } catch (e) {
            console.error("Error adding received ICE candidate", e);
          }
        }
      } catch (e) {
        console.error(e);
      }
    });

    await connection.start();

    const connId = await connection.invoke('GetConnectionId');
    setConnectionId(connId);
  };

  const handleOffer = async (signal, senderConnectionId) => {
    if (!peerConnectionRef.current) {
      console.error("peerConnection chưa được khởi tạo");
      return;
    }

    console.log("Handling Offer...");

    setTargetConnectionId(senderConnectionId);

    try {
      let offerSession = new RTCSessionDescription({
        sdp: signal.sdp,
        type: signal.type
      });

      await peerConnectionRef.current.setRemoteDescription(offerSession);

    }
    catch (e) {
      console.log("handleOffer Error : " + e);
    }

    console.log("Sending answer...");

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);


    await signalRConnectionRef.current.invoke("SendSignal", senderConnectionId, JSON.stringify({
      type: "answer",
      sdp: answer.sdp,
    }));
  };


  const handleAnswer = async (answerSdp) => {
    if (!peerConnectionRef.current) {
      console.error("peerConnection chưa được khởi tạo");
      return;
    }

    console.log("Handling Answer...");

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerSdp));
      console.log("Remote description set with answer SDP.");
    } catch (error) {
      console.error("Error setting remote description with answer:", error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>WebRTC Chat</h1>
      <div style={{ marginBottom: "20px" }}>
        <p><strong>Your Connection ID:</strong> {connectionId}</p>
        <p><strong>App Connection ID:</strong> {targetConnectionId}</p>

        <div>
          {isConnected ? (
            <p style={{ color: 'green' }}>Đã kết nối thành công!</p>
          ) : (
            <p style={{ color: 'red' }}>Chưa kết nối</p>
          )}
        </div>
      </div>


      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {remoteStream && (
          <video
            autoPlay
            playsInline
            ref={(video) => {
              if (video) video.srcObject = remoteStream;
            }}
            style={{
              width: '100%',
              border: '1px solid #ccc',
              borderRadius: '8px'
            }}
          />
        )}
      </div>

    </div>
  );
}
export default App;