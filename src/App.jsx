import { useState, useRef } from "react";

function App() {
  const [localSDP, setLocalSDP] = useState("");
  const [remoteSDP, setRemoteSDP] = useState("");
  const [connection, setConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const initializeBroadcaster = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setIsBroadcaster(true);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { 
            urls: "turn:turn.onox.pro:3478",
            username: "octopus",
            credential: "0559551321"
          }
        ],
      });

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      setConnection(pc);
    } catch (error) {
      console.error("Error initializing broadcaster:", error);
    }
  };

  const initializeViewer = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { 
            urls: "turn:turn.onox.pro:3478",
            username: "octopus",
            credential: "0559551321"
          }
        ],
      });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      setConnection(pc);
      setIsBroadcaster(false);
    } catch (error) {
      console.error("Error initializing viewer:", error);
    }
  };

  const createOffer = async () => {
    if (!connection || !isBroadcaster) return;
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      setLocalSDP(JSON.stringify(offer));
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  const setRemoteDescription = async () => {
    if (!connection) return;
    try {
      const remoteDesc = JSON.parse(remoteSDP);
      await connection.setRemoteDescription(new RTCSessionDescription(remoteDesc));

      if (!isBroadcaster && remoteDesc.type === "offer") {
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        setLocalSDP(JSON.stringify(answer));
      }
    } catch (error) {
      console.error("Error setting remote description:", error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>WebRTC Livestream</h1>
      
      <div>
        <button onClick={initializeBroadcaster}>Start Broadcasting</button>
        <button onClick={initializeViewer}>Join as Viewer</button>
      </div>

      {isBroadcaster ? (
        <div style={{ marginTop: "20px" }}>
          <h3>Broadcaster View</h3>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline
            style={{ width: "300px" }} 
          />
          <button onClick={createOffer}>Start Stream</button>
        </div>
      ) : (
        <div style={{ marginTop: "20px" }}>
          <h3>Viewer View</h3>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
            style={{ width: "300px" }} 
          />
        </div>
      )}

      <div style={{ marginTop: "20px" }}>
        <h3>Connection Setup</h3>
        <textarea
          value={localSDP}
          readOnly
          placeholder="Local SDP"
          style={{ width: "100%", height: "100px" }}
        />
        <textarea
          value={remoteSDP}
          onChange={(e) => setRemoteSDP(e.target.value)}
          placeholder="Remote SDP"
          style={{ width: "100%", height: "100px" }}
        />
        <button onClick={setRemoteDescription}>Set Remote Description</button>
      </div>
    </div>
  );
}

export default App;