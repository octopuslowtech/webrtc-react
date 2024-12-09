import { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';

function App() {
  const peerConnectionRef = useRef(null);
  const signalRConnectionRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [dataChannel, setDataChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState('');
  const [targetConnectionId, setTargetConnectionId] = useState('');

  const iceServers = [
    // { urls: 'stun:stun.l.google.com:19302' },
    // { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:turn.onox.pro:3478',
      username: 'octopus',
      credential: '0559551321'
    },
    // {
    //   urls: 'turn:relay1.expressturn.com:3478',
    //   username: 'efLDK4QL9WAH27Z6AJ',
    //   credential: 'E5AwlcaSDOiKwx4U'
    // }
  ];

  useEffect(() => {
    initializePeerConnection();
    connectSignalR();
  }, []);

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers });
  
    // Theo dõi trạng thái kết nối
    pc.onconnectionstatechange = () => {
      console.log('Trạng thái kết nối:', pc.connectionState);
    };
  
    // Theo dõi trạng thái ICE
    pc.oniceconnectionstatechange = () => {
      console.log('Trạng thái ICE:', pc.iceConnectionState);
    };
  
    pc.onicegatheringstatechange = () => {
      console.log('Trạng thái thu thập ICE:', pc.iceGatheringState);
    };
  
    pc.onicecandidate = (event) => {
      if (event.candidate && signalRConnectionRef.current && targetConnectionId) {
        console.log('Đang gửi ICE candidate:', event.candidate.type);
        signalRConnectionRef.current.invoke("SendSignal", targetConnectionId, JSON.stringify({
          type: 'candidate',
          candidate: event.candidate
        }));
      } else {
        console.log('Kết thúc thu thập candidates');
      }
    };
  
    // Theo dõi trạng thái data channel
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
      
      setDataChannel(channel);
      if(!channel)
        console.log('channel is null');
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
      console.log('Received signal from:', senderConnectionId + ' - ' + signalData);
      try {
        const signal = JSON.parse(signalData);
        if (signal.type === 'offer') {
          console.log("Received offer...");
          await handleOffer(signal.sdp, senderConnectionId);
        } else if (signal.type === 'answer') {
          console.log("Received answer...");
          await handleAnswer(signal.sdp);
        } else if (signal.type === 'candidate') {
          console.log("Received ICE candidate...");
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
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

  const createOffer = async () => {
    if (!peerConnectionRef.current) {
      console.error("peerConnection chưa được khởi tạo");
      return;
    }

    if (!targetConnectionId) {
      console.error("Chưa nhập Connection ID của người nhận");
      return;
    }

    console.log("Creating offer...");

    const channel = peerConnectionRef.current.createDataChannel('chat');
    channel.onmessage = handleReceiveMessage;
    channel.onopen = () => {
      console.log("Data channel đã mở");
      setIsConnected(true);
    };
    channel.onclose = () => {
      console.log("Data channel đã đóng");
      setIsConnected(false);
    };

    setDataChannel(channel);

    const offer = await peerConnectionRef.current.createOffer();

    await peerConnectionRef.current.setLocalDescription(offer);

    console.log("Sending offer...");

    signalRConnectionRef.current.invoke("SendSignal", targetConnectionId, JSON.stringify({
      type: 'offer',
      sdp: offer
    }));

  };

  const handleOffer = async (offerSdp, senderConnectionId) => {
    if (!peerConnectionRef.current) {
      console.error("peerConnection chưa được khởi tạo");
      return;
    }

    console.log("Handling Offer...");

    // Thiết lập targetConnectionId để trả lời lại cho người gửi
    setTargetConnectionId(senderConnectionId);

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    console.log("Sending answer...");
    signalRConnectionRef.current.invoke("SendSignal", senderConnectionId, JSON.stringify({
      type: 'answer',
      sdp: answer
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
      <h1>WebRTC Chat</h1>

      {/* Hiển thị connectionId của bạn */}
      <div>
        <p><strong>Your Connection ID:</strong> {connectionId}</p>
      </div>

      {/* Nhập ID của người nhận */}
      <div>
        <label>
          Nhập Connection ID của người nhận:
          <input
            type="text"
            value={targetConnectionId}
            onChange={(e) => setTargetConnectionId(e.target.value)}
            style={{ marginLeft: '10px', width: '300px' }}
          />
        </label>
      </div>

      <div>
        {isConnected ? (
          <p style={{ color: 'green' }}>Đã kết nối thành công!</p>
        ) : (
          <p style={{ color: 'red' }}>Chưa kết nối</p>
        )}
      </div>

      <div>
        <button onClick={createOffer}>Create Connection</button>
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