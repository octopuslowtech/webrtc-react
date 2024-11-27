import React, { useState, useRef } from "react";
import Peer from "peerjs";

function App() {
  const [peer, setPeer] = useState(null);
  const [remotePeerId, setRemotePeerId] = useState("");
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const [currentCall, setCurrentCall] = useState(null);

  const initPeer = () => {
    const newPeer = new Peer(null, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { 
            urls: "turns:turn.onox.pro:443",
            username: "octopus",
            credential: "0559551321"
          }
        ],
      },
    });

    newPeer.on('open', (id) => {
      console.log('Peer ID: ', id);
      setPeer(newPeer);
    });

    newPeer.on("call", (call) => {
      call.answer(localStreamRef.current);

      call.on("stream", (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        console.log("Call closed");
      });

      call.on("error", (err) => {
        console.error("Call error: ", err);
      });
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((error) => console.error("Error accessing media devices.", error));

    setPeer(newPeer);
  };

  const startCall = () => {
    if (peer && remotePeerId && localStreamRef.current) {
      const call = peer.call(remotePeerId, localStreamRef.current);

      call.on("stream", (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        console.log("Call closed");
      });

      call.on("error", (err) => {
        console.error("Call error: ", err);
      });

      setCurrentCall(call);
    }
  };

  const endCall = () => {
    if (currentCall) {
      currentCall.close();
      setCurrentCall(null);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>WebRTC Test with PeerJS</h1>
      <div>
        <button onClick={initPeer}>Initialize Peer</button>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Local Video</h3>
        <video ref={localVideoRef} autoPlay muted style={{ width: "300px" }} />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Remote Video</h3>
        <video ref={remoteVideoRef} autoPlay style={{ width: "300px" }} />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Remote Peer ID</h3>
        <input
          type="text"
          value={remotePeerId}
          onChange={(e) => setRemotePeerId(e.target.value)}
          placeholder="Enter remote peer ID"
          style={{ width: "100%", padding: "8px" }}
        />
        <button onClick={startCall} style={{ marginTop: "10px" }}>Start Call</button>
        <button onClick={endCall} style={{ marginTop: "10px", marginLeft: "10px" }}>End Call</button>
      </div>
    </div>
  );
}

export default App;