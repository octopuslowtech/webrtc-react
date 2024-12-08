import { useState, useEffect } from "react";
import { HubConnectionBuilder } from "@microsoft/signalr";

function App() {
  const [signalRConnection, setSignalRConnection] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    const initSignalR = async () => {
      const connection = new HubConnectionBuilder()
        .withUrl("https://api.maxcloudphone.com/deviceHub")
        .build();

      connection.on("ReceiveSignal", async (data) => {
        const signal = JSON.parse(data);

        if (signal.type === "offer") {
          await handleRemoteOffer(signal.sdp);
        } else if (signal.type === "answer") {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(signal.sdp)
          );
        } else if (signal.type === "candidate") {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(signal.candidate)
          );
        }
      });

      await connection.start();
      setSignalRConnection(connection);
      initializePeerConnection();
      setMessages((prev) => [...prev, { text: "Connected", received: true }]);
    };

    initSignalR();
  }, []);

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:turn.onox.pro:3478",
          username: "octopus",
          credential: "0559551321",
        },
      ],
    });

    // Create data channel
    const channel = pc.createDataChannel("chat");
    channel.onmessage = handleReceiveMessage;
    setDataChannel(channel);

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const incomingChannel = event.channel;
      incomingChannel.onmessage = handleReceiveMessage;
      setDataChannel(incomingChannel);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalRConnection.invoke(
          "SendSignal",
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          })
        );
      }
    };

    setPeerConnection(pc);
  };

  const handleRemoteOffer = async (sdp) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    signalRConnection.invoke(
      "SendSignal",
      JSON.stringify({
        type: "answer",
        sdp: answer,
      })
    );
  };

  const handleReceiveMessage = (event) => {
    setMessages((prev) => [...prev, { text: event.data, received: true }]);
  };

  const sendMessage = () => {
    if (currentMessage && dataChannel) {
      dataChannel.send(currentMessage);
      setMessages((prev) => [...prev, { text: currentMessage, received: false }]);
      setCurrentMessage("");
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.received ? "received" : "sent"}`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
      <style jsx>{`
        .chat-container {
          width: 400px;
          height: 600px;
          border: 1px solid #ccc;
          display: flex;
          flex-direction: column;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }
        .message {
          margin: 5px;
          padding: 8px;
          border-radius: 8px;
          max-width: 70%;
        }
        .sent {
          background-color: #007bff;
          color: white;
          margin-left: auto;
        }
        .received {
          background-color: #e9ecef;
          margin-right: auto;
        }
        .input-area {
          display: flex;
          padding: 10px;
          border-top: 1px solid #ccc;
        }
        input {
          flex: 1;
          margin-right: 10px;
          padding: 5px;
        }
        button {
          padding: 5px 15px;
        }
      `}</style>
    </div>
  );
}

export default App;