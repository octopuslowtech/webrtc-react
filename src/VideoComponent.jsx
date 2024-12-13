import { useEffect, useRef, memo } from 'react';


const VideoComponent = memo(({ remoteStream }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (remoteStream && videoRef.current) {
            videoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    return (
        <video
            id="remoteVideo"
            autoPlay
            playsInline
            ref={videoRef}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                border: 'none',
            }}
        />
    );
});

export default VideoComponent