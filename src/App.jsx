import { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import VideoComponent from './VideoComponent';

function App() {
  const peerConnectionRef = useRef(null);
  const signalRConnectionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);


  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [dataChannel, setDataChannel] = useState(null);

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
    }
    ,
    {
      urls: 'turn:relay1.expressturn.com:3478',
      username: 'efLDK4QL9WAH27Z6AJ',
      credential: 'E5AwlcaSDOiKwx4U'
    }
  ];

  const videoRef = useRef(null);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    initializePeerConnection();
    connectSignalR();

    return () => {
      if (signalRConnectionRef.current) {
        signalRConnectionRef.current.stop();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0])
        setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Using ICE server:', event.candidate.address);
      }
      if (event.candidate && signalRConnectionRef.current) {
        signalRConnectionRef.current.invoke("SendSignal", JSON.stringify({
          type: 'candidate',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        }));


      } else {
        console.log('Kết thúc thu thập candidates');
      }
    };


    pc.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", pc.iceConnectionState);
      setIsConnected(pc.iceConnectionState === 'connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed') {
        setIsConnected(false);
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('Data channel được tạo:', channel.label);

      channel.onopen = () => {
        console.log('Data channel đã mở, trạng thái:', channel.readyState);
        setIsConnected(true);
        setDataChannel(channel);
      };

      channel.onclose = () => {
        console.log('Data channel đã đóng');
        setIsConnected(false);
      };

      channel.onerror = (error) => {
        console.error('Lỗi data channel:', error);
      };

      channel.onmessage = handleReceiveMessage;
      setDataChannel(channel);
      if (!channel)
        console.log('channel is null');
    };

    peerConnectionRef.current = pc;
  };

  const connectSignalR = async () => {
    const jwtToken = "";

    const connection = new HubConnectionBuilder()
      .withUrl('https://api.maxcloudphone.com/deviceHub', {
        accessTokenFactory: () => jwtToken
      })
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

  };

  const handleOffer = async (signal) => {
    if (!peerConnectionRef.current) {
      console.error("peerConnection chưa được khởi tạo");
      return;
    }

    console.log("Handling Offer...");

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


    await signalRConnectionRef.current.invoke("SendSignal", JSON.stringify({
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


  const handleReceiveMessage = (event) => {
    setMessages(prev => [...prev, { text: event.data, received: true }]);
  };

  const sendMessage = () => {
    if (!dataChannel) {
      console.log('dataChannel is undefined');
      return;
    }
    if (dataChannel.readyState !== 'open') {
      console.log(`Không thể gửi tin nhắn - trạng thái kênh: ${dataChannel.readyState}`);
      return;
    }
    dataChannel.send(currentMessage);
    setMessages(prev => [...prev, { text: currentMessage, received: false }]);
    setCurrentMessage('');
  };

  return (
    <div style={{ padding: "20px" }}>
      <div>
        <h3>Thông tin kết nối</h3>
        <div>
          {isConnected ? (
            <p style={{ color: 'green' }}>Đã kết nối thành công!</p>
          ) : (
            <p style={{ color: 'red' }}>Chưa kết nối</p>
          )}
        </div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '800px',
        aspectRatio: '16/9', // Set proper aspect ratio
        overflow: 'hidden'
      }}>
        <VideoComponent remoteStream={remoteStream} />
      </div>


      <div style={{ marginTop: "20px" }}>
        <h3>Chat</h3>
        <div className="messages" style={{
          height: '400px',
          border: '1px solid #ccc',
          overflowY: 'auto',
          padding: '10px',
          marginBottom: '20px'
        }}>
          {messages.map((msg, index) => (
            <div key={index} style={{
              textAlign: msg.received ? 'left' : 'right',
              margin: '5px',
              padding: '8px',
              backgroundColor: msg.received ? '#e9ecef' : '#007bff',
              color: msg.received ? 'black' : 'white',
              borderRadius: '8px',
              maxWidth: '70%',
              marginLeft: msg.received ? '0' : 'auto'
            }}>
              {msg.text}
            </div>
          ))}
        </div>
        <div className="input-area" style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            style={{ flex: 1 }}
            placeholder="Nhập tin nhắn..."
          />
          <button onClick={sendMessage}>Gửi</button>
        </div>
      </div>
    </div>
  );
}
export default App;