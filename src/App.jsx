import { useState, useRef } from "react";

function App() {
  const [localSDP, setLocalSDP] = useState("");
  const [remoteSDP, setRemoteSDP] = useState("");
  const [connection, setConnection] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [iceCandidates, setIceCandidates] = useState([]);
  const [isOfferer, setIsOfferer] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const initialize = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

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

      // Thêm các event listeners để theo dõi trạng thái kết nối
      pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log("Connection State:", pc.connectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log("Signaling State:", pc.signalingState);
      };

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log("Added track:", track.kind);
      });

      pc.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log("Remote video metadata loaded");
            remoteVideoRef.current.play().catch(e => 
              console.error("Error playing remote video:", e)
            );
          };
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate:", event.candidate);
          setIceCandidates(prev => [...prev, event.candidate]);
        }
      };

      setConnection(pc);
      console.log("Peer Connection initialized");
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  const createOffer = async () => {
    if (!connection) {
      alert("Please initialize first!");
      return;
    }
    try {
      setIsOfferer(true);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      setLocalSDP(JSON.stringify(offer));
      console.log("Offer created:", connection.signalingState);
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  const createAnswer = async () => {
    if (!connection) {
      alert("Initialize first!");
      return;
    }
    try {
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      setLocalSDP(JSON.stringify(connection.localDescription));
      console.log("Answer created");
    } catch (error) {
      console.error("Error creating answer:", error);
    }
  };

  const setRemoteDescription = async () => {
    if (!connection) {
      alert("Please initialize first!");
      return;
    }
    try {
      const remoteDesc = JSON.parse(remoteSDP);
      console.log("Current state:", connection.signalingState);
      console.log("Setting remote description type:", remoteDesc.type);

      if (remoteDesc.type === "offer") {
        // We're receiving an offer
        await connection.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        setLocalSDP(JSON.stringify(answer));
        console.log("Answer created");
      } else if (remoteDesc.type === "answer" && isOfferer) {
        // We're receiving an answer to our offer
        if (connection.signalingState === "have-local-offer") {
          await connection.setRemoteDescription(new RTCSessionDescription(remoteDesc));
          console.log("Remote answer set");
        } else {
          console.error("Cannot set remote answer - wrong state:", connection.signalingState);
        }
      }
    } catch (error) {
      console.error("Error in setRemoteDescription:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const endConnection = () => {
    if (connection) {
      connection.close();
      setConnection(null);
      setRemoteStream(null);
      setLocalSDP("");
      setRemoteSDP("");
      console.log("Connection closed");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Manual WebRTC Connection</h1>

      <div>
        <button onClick={initialize}>Initialize Connection</button>
        <button onClick={endConnection} style={{ marginLeft: "10px" }}>
          End Connection
        </button>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Local Video</h3>
        <video ref={localVideoRef} autoPlay muted style={{ width: "300px" }} />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Remote Video</h3>
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          style={{ 
            width: "300px",
            backgroundColor: "#000" 
          }} 
        />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Create Offer</h3>
        <button onClick={createOffer}>Create Offer</button>
        <textarea
          value={localSDP}
          readOnly
          placeholder="SDP Offer will appear here"
          style={{ width: "100%", height: "150px", marginTop: "10px" }}
        />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Create Answer</h3>
        <button onClick={createAnswer}>Create Answer</button>
        <textarea
          value={localSDP}
          readOnly
          placeholder="SDP Answer will appear here"
          style={{ width: "100%", height: "150px", marginTop: "10px" }}
        />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Set Remote SDP</h3>
        <textarea
          value={remoteSDP}
          onChange={(e) => setRemoteSDP(e.target.value)}
          placeholder="Paste remote SDP here"
          style={{ width: "100%", height: "150px" }}
        />
        <button onClick={setRemoteDescription} style={{ marginTop: "10px" }}>
          Set Remote Description
        </button>
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>ICE Candidates</h3>
        <pre style={{ maxHeight: "100px", overflow: "auto" }}>
          {JSON.stringify(iceCandidates, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default App;