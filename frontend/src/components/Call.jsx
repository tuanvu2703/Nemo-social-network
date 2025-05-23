import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import authToken from "../components/authToken";
import { PhoneXMarkIcon, XMarkIcon } from "@heroicons/react/16/solid";

export default function Call({ onClose, isOpen, targetUserIds, status }) {
    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const peerConnections = useRef({});
    const iceCandidatesBuffer = useRef({});
    const pendingStreams = useRef({});
    const [userId, setUserId] = useState(null);
    const [socket, setSocket] = useState(null);
    const [stream, setStream] = useState(null);
    const [callStatus, setCallStatus] = useState(status);
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [hasStartedCall, setHasStartedCall] = useState(false);

    const URL = `${process.env.REACT_APP_API_URL}`;

    const iceServers = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    useEffect(() => {
        if (isOpen && !stream) {
            const getMediaDevices = async () => {
                try {
                    const userStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                    console.log("✅ [Media] Đã lấy stream thành công");
                    setStream(userStream);
                    setIsStreamReady(true);
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = userStream;
                    }
                } catch (err) {
                    console.error("❌ [Media] Lỗi lấy thiết bị media:", err);
                    alert("Không thể truy cập camera hoặc micro! vui lòng kiểm tra lại.");
                    setIsStreamReady(false);
                }
            };
            getMediaDevices();
        } else if (!isOpen) {
            cleanupMediaStream();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isStreamReady && targetUserIds && !socket) {
            connectSocket();
        }
        if (isStreamReady && targetUserIds && socket && !hasStartedCall) {
            startCall();
            setHasStartedCall(true);
        }
    }, [isStreamReady, targetUserIds, socket, hasStartedCall]);

    const cleanupMediaStream = () => {
        if (stream) {
            console.log("🧹 [Media] Dọn dẹp stream");
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setIsStreamReady(false);
        }
    };

    useEffect(() => {
        const remoteVideosContainer = document.getElementById("remote-videos");
        if (remoteVideosContainer && Object.keys(pendingStreams.current).length > 0) {
            Object.entries(pendingStreams.current).forEach(([targetId, stream]) => {
                if (!remoteVideoRefs.current[targetId] || !document.getElementById(`video-${targetId}`)) {
                    console.log(`🎥 [Render] Processing pending stream for: ${targetId}`);

                    const videoContainer = document.createElement("div");
                    videoContainer.className = "absolute inset-0 flex items-center justify-center";
                    videoContainer.id = `video-container-${targetId}`;

                    const video = document.createElement("video");
                    video.autoplay = true;
                    video.playsInline = true;
                    video.className = "w-full h-full object-cover";
                    video.id = `video-${targetId}`;

                    videoContainer.appendChild(video);
                    remoteVideosContainer.appendChild(videoContainer);

                    remoteVideoRefs.current[targetId] = video;
                    video.srcObject = stream;
                    video.play().catch((err) => {
                        console.error(`❌ [Render] Lỗi phát video cho user ${targetId}:`, err);
                    });
                }
            });
            // Don't clear pending streams here, as they might be needed for re-rendering
        }
    }, [callStatus]);

    useEffect(() => {
        if (isStreamReady && targetUserIds && socket && !hasStartedCall) {
            if (status === 'calling') {
                startCall();
            } else if (status === 'in-call') {
                // If we're joining a call that's already in progress
                console.log("✅ [Call] Joining ongoing call");
                setCallStatus("in-call");
            }
            setHasStartedCall(true);
        }
    }, [isStreamReady, targetUserIds, socket, hasStartedCall, status]);

    // Process buffered ICE candidates
    const processBufferedIceCandidates = async (peerId) => {
        const pc = peerConnections.current[peerId];
        const candidates = iceCandidatesBuffer.current[peerId] || [];

        if (pc && pc.remoteDescription && candidates.length > 0) {
            console.log(`🔄 [Peer] Processing ${candidates.length} buffered ICE candidates for: ${peerId}`);

            for (const candidate of candidates) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log(`✅ [Peer] Added buffered ICE candidate for: ${peerId}`);
                } catch (error) {
                    console.error(`❌ [Peer] Failed to add buffered ICE candidate for ${peerId}:`, error);
                }
            }

            // Clear processed candidates
            iceCandidatesBuffer.current[peerId] = [];
        }
    };

    const createPeerConnection = (targetId) => {
        console.log("🔗 [Peer] Tạo PeerConnection với:", targetId);
        const pc = new RTCPeerConnection(iceServers);

        // Add local tracks to the connection
        if (stream) {
            stream.getTracks().forEach((track) => {
                console.log("➕ [Peer] Thêm track vào PeerConnection:", track.kind);
                pc.addTrack(track, stream);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (e) => {
            if (e.candidate && socket) {
                console.log("❄️ [Peer] Gửi ICE candidate tới:", targetId);
                socket.emit("ice-candidate", { targetUserId: targetId, candidate: e.candidate });
            }
        };

        // Handle incoming tracks/streams
        pc.ontrack = (e) => {
            console.log(`✅ [Peer] Received track from: ${targetId}, kind: ${e.track.kind}`);

            // Store the stream for later rendering if not already stored
            if (!pendingStreams.current[targetId]) {
                pendingStreams.current[targetId] = e.streams[0];
            }

            const remoteVideosContainer = document.getElementById("remote-videos");
            if (!remoteVideosContainer) {
                console.error("❌ [Render] Không tìm thấy container remote-videos trong DOM");
                return;
            }

            // Only create video element if it doesn't already exist
            if (!remoteVideoRefs.current[targetId]) {
                console.log(`🎥 [Render] Creating new video element for: ${targetId}`);
                const videoContainer = document.createElement("div");
                videoContainer.className = "absolute inset-0 flex items-center justify-center";
                videoContainer.id = `video-container-${targetId}`;

                const video = document.createElement("video");
                video.autoplay = true;
                video.playsInline = true;
                video.className = "w-full h-full object-cover";
                video.id = `video-${targetId}`;

                videoContainer.appendChild(video);
                remoteVideosContainer.appendChild(videoContainer);

                remoteVideoRefs.current[targetId] = video;
            }

            // Set the stream to the video element
            if (remoteVideoRefs.current[targetId]) {
                const videoElement = remoteVideoRefs.current[targetId];
                videoElement.srcObject = e.streams[0];

                // Play when metadata is loaded instead of immediately
                videoElement.onloadedmetadata = () => {
                    console.log(`✅ [Render] Video ready to play for: ${targetId}`);
                    videoElement.play().catch(err => {
                        console.error(`❌ [Render] Error playing video: ${err}`);
                        // Retry play with user interaction if needed
                        if (err.name === "NotAllowedError") {
                            console.log("⚠️ [Render] Autoplay prevented, waiting for user interaction");
                        }
                    });
                };
            }
        };

        // Monitor connection state
        pc.oniceconnectionstatechange = () => {
            console.log(`ℹ️ [Peer] ICE connection state for ${targetId}: ${pc.iceConnectionState}`);

            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                console.log("❌ [Peer] Kết nối ICE thất bại với:", targetId);
                cleanupPeer(targetId);
            } else if (pc.iceConnectionState === "connected") {
                console.log(`✅ [Peer] ICE connected with: ${targetId}`);
            }
        };

        // Monitor signaling state
        pc.onsignalingstatechange = () => {
            console.log(`ℹ️ [Peer] Signaling state for ${targetId}: ${pc.signalingState}`);
        };

        return pc;
    };

    const connectSocket = () => {
        const token = authToken.getToken();
        if (!token) {
            console.error("❌ [Socket] Không tìm thấy token");
            return;
        }
        if (socket) return;

        try {
            const newSocket = io(URL, {
                extraHeaders: { Authorization: `Bearer ${token}` },
            });

            newSocket.on("connect_error", (err) => {
                console.error("❌ [Socket] Lỗi kết nối:", err.message);
                alert("Không thể kết nối tới server, vui lòng kiểm tra lại.");
            });

            setSocket(newSocket);
        } catch (error) {
            console.error("❌ [Socket] Lỗi khi khởi tạo socket:", error);
            alert("Đã xảy ra lỗi khi kết nối socket.");
        }
    };

    useEffect(() => {
        if (!socket) return;

        socket.on("connect", () => {
            console.log("✅ [Socket] Kết nối WebSocket thành công");
        });

        socket.on("disconnect", () => {
            console.log("❌ [Socket] WebSocket ngắt kết nối");
            setCallStatus("disconnected");
            alert("Mất kết nối với server, vui lòng thử lại.");
            endCall();
        });

        socket.on("userId", ({ userId }) => {
            console.log("🆔 [Socket] Nhận userId:", userId);
            setUserId(userId);
        });

        socket.on("callAccepted", ({ from }) => {
            console.log("✅ [Socket] Call accepted by:", from);
            setCallStatus("in-call");
        });

        socket.on("callRejected", ({ from }) => {
            console.log("❌ [Socket] Nhận callRejected từ:", from);
            cleanupPeer(from);
            cleanupPeer(userId);
            setCallStatus("idle");
        });

        socket.on("callEnded", ({ from }) => {
            console.log("🚫 [Socket] Nhận callEnded từ:", from);
            cleanupPeer(from);
            cleanupPeer(userId);
            setCallStatus("idle");
        });

        socket.on("offer", async ({ from, sdp }) => {
            if (!isStreamReady) return;

            try {
                if (peerConnections.current[from]) {
                    const pc = peerConnections.current[from];
                    if (pc.signalingState === "stable") {
                        console.log("⚠️ [Peer] Đã ở trạng thái stable, bỏ qua offer từ:", from);
                        return;
                    }
                } else {
                    console.log("🔗 [Peer] Tạo PeerConnection mới vì chưa tồn tại cho:", from);
                    peerConnections.current[from] = createPeerConnection(from);
                }

                const pc = peerConnections.current[from];

                // Set remote description first
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                console.log(`✅ [Peer] Remote offer set for: ${from}`);

                // Create and set local answer
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                console.log(`📤 [Socket] Sending answer to: ${from}`);

                // Send answer to peer
                socket.emit("answer", { targetUserId: from, sdp: answer });
                console.log("✅ [Socket] Đã gửi answer thành công tới:", from);

                if (iceCandidatesBuffer.current[from]) {
                    for (const candidate of iceCandidatesBuffer.current[from]) {
                        console.log("❄️ [Socket] Xử lý ICE candidate từ buffer cho:", from);
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    delete iceCandidatesBuffer.current[from];
                }

                // When receiving an offer and we're the one being called
                if (status === 'incoming') {
                    // Let the caller know we've accepted
                    socket.emit("callAccepted", { targetUserId: from });
                    setCallStatus("in-call");
                }

                // Process any buffered ICE candidates for this peer
                await processBufferedIceCandidates(from);

                setCallStatus("in-call");
            } catch (error) {
                console.error(`❌ [Peer] Error handling offer from ${from}:`, error);
            }
        });

        socket.on("answer", async ({ from, sdp }) => {
            console.log(`[Socket] Received 'answer' event. From: ${from}, Local User ID: ${userId}`);

            // Check if answer is from self
            if (from === userId) {
                console.warn(`[Peer] Ignoring 'answer' event potentially from self (${from}).`);
                return;
            }

            const pc = peerConnections.current[from];
            if (!pc) {
                console.warn(`[Peer] PeerConnection for ${from} not found when receiving answer.`);
                return;
            }

            // Only the caller (who sent offer) should process answers
            if (!pc.localDescription) {
                console.warn(`[Peer] Instance (${userId}) received an answer from ${from}, but doesn't seem to be the caller. Ignoring answer.`);
                return;
            }

            // Check if remote description already exists
            if (pc.remoteDescription) {
                console.warn(`⚠️ [Peer] Remote description already exists for ${from}. Ignoring new answer. SignalingState: ${pc.signalingState}`);
                return;
            }

            try {
                // Set the remote description
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                console.log(`✅ [Peer] Remote answer SDP set successfully for: ${from}. New SignalingState: ${pc.signalingState}`);

                // Process any buffered ICE candidates
                if (iceCandidatesBuffer.current[from]) {
                    console.log(`[Peer] Processing ${iceCandidatesBuffer.current[from].length} buffered ICE candidates for ${from}.`);
                    for (const candidate of iceCandidatesBuffer.current[from]) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                            console.log(`❄️ [Peer] Added buffered ICE candidate for ${from}`);
                        } catch (iceError) {
                            console.error(`❌ [Peer] Error adding buffered ICE candidate for ${from}:`, iceError);
                        }
                    }
                    delete iceCandidatesBuffer.current[from];
                }

                await processBufferedIceCandidates(from);
                setCallStatus("in-call");
            } catch (error) {
                console.error(`❌ [Socket] Error processing answer from ${from}:`, error);
                cleanupPeer(from);
            }
        });

        socket.on("ice-candidate", async ({ from, candidate }) => {
            try {
                console.log(`📥 [Socket] Received ICE candidate from: ${from}`);

                // If peer connection doesn't exist yet, create it
                if (!peerConnections.current[from]) {
                    console.log(`⏳ [Peer] Creating peer connection for: ${from} due to ICE candidate`);
                    peerConnections.current[from] = createPeerConnection(from);
                }

                const pc = peerConnections.current[from];

                // Buffer the candidate if remote description isn't set yet
                if (!pc.remoteDescription) {
                    console.log(`⏳ [Socket] Buffering ICE candidate for: ${from}`);
                    if (!iceCandidatesBuffer.current[from]) {
                        iceCandidatesBuffer.current[from] = [];
                    }
                    iceCandidatesBuffer.current[from].push(candidate);
                    return;
                }

                // Otherwise add it directly
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log(`❄️ [Peer] Added ICE candidate for: ${from}`);
            } catch (error) {
                console.error(`❌ [Socket] Error processing ICE candidate from ${from}:`, error);
            }
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("userId");
            socket.off("incomingCall");
            socket.off("callRejected");
            socket.off("callEnded");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
            socket.off("callAccepted");
        };
    }, [socket, isStreamReady, status, userId]);

    const startCall = async () => {
        if (!targetUserIds || !socket || !stream) {
            console.log("⚠️ [Call] Thiếu điều kiện để bắt đầu cuộc gọi:", { targetUserIds, socket, stream });
            return;
        }

        const ids = targetUserIds.split(",").map((id) => id.trim());
        if (ids.length > 5) return alert("Tối đa 5 người trong nhóm");

        console.log("📞 [Socket] Gửi startCall tới:", ids);
        socket.emit("startCall", { targetUserIds: ids });
        setCallStatus("calling");

        // Create offer for each target user
        for (const targetId of ids) {
            try {
                // Clean up existing connection if needed
                if (peerConnections.current[targetId]) {
                    console.log(`🧹 [Peer] Đã tồn tại, xóa PeerConnection cũ cho: ${targetId}`);
                    cleanupPeer(targetId);
                }

                // Create peer connection
                peerConnections.current[targetId] = createPeerConnection(targetId);
                const pc = peerConnections.current[targetId];

                // Create and set local offer
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });

                await pc.setLocalDescription(offer);
                console.log("📤 [Socket] Gửi offer tới:", targetId);

                // Send offer to peer
                socket.emit("offer", { targetUserId: targetId, sdp: offer });
            } catch (error) {
                console.error(`❌ [Peer] Error creating offer for ${targetId}:`, error);
            }
        }
    };

    const endCall = () => {
        console.log("🚫 [Socket] Gửi endCall");

        // Send end call signal to all other users first
        if (socket) {
            console.log("📤 [Socket] Thông báo cuộc gọi kết thúc tới tất cả người dùng");
            socket.emit("endCall");
        }

        // Clean up all peer connections
        Object.keys(peerConnections.current).forEach((targetId) => cleanupPeer(targetId));

        // Clean up local resources
        cleanupMediaStream();
        if (userId) cleanupPeer(userId);

        // Update UI state
        setCallStatus("idle");
        setHasStartedCall(false);

        // Call onClose callback
        if (onClose) onClose();
    };

    function cleanupPeer(peerId) {
        if (peerConnections.current[peerId]) {
            peerConnections.current[peerId].close();
            delete peerConnections.current[peerId];

            // Also clean up video element if exists
            if (remoteVideoRefs.current[peerId]) {
                const videoElement = remoteVideoRefs.current[peerId];
                if (videoElement.srcObject) {
                    const tracks = videoElement.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    videoElement.srcObject = null;
                }
                delete remoteVideoRefs.current[peerId];
            }

            console.log(`🧹 [Peer] Đã dọn dẹp PeerConnection cho: ${peerId}`);
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="relative w-full h-full p-6 rounded-lg shadow-lg">
                {/* Hiển thị trạng thái cuộc gọi */}
                {callStatus === "calling" && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-md shadow-md">
                        <p className="text-gray-800 font-medium">Đang gọi...</p>
                    </div>
                )}

                {callStatus === "idle" && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-md shadow-md z-50">
                        <p className="text-gray-800 font-medium">Cuộc gọi kết thúc</p>
                    </div>
                )}

                {/* Container video từ xa */}
                <div
                    id="remote-videos"
                    className="absolute inset-0 w-full h-full"
                >
                    {/* Các phần tử video từ xa sẽ được render tại đây */}
                </div>

                {/* Video cục bộ */}
                <div className="absolute bottom-3 right-3 z-10">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-72 rounded-md border border-gray-300 shadow-md"
                    />
                </div>

                {/* Nút điều khiển cuộc gọi */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    {(callStatus === "calling" || callStatus === "in-call") && (
                        <button
                            onClick={endCall}
                            className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
                            aria-label="End call"
                            disabled={callStatus === "idle"}
                        >
                            <PhoneXMarkIcon className="h-10 w-10 text-red-600" />
                        </button>
                    )}

                    {callStatus === "idle" && (
                        <button
                            onClick={endCall}
                            className="bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
                            aria-label="Close"
                        >
                            <XMarkIcon className="h-14 w-14 bg-white cursor-pointer rounded-full text-red-600 p-1 shadow-lg" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}