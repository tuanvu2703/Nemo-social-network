import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import authToken from "../components/authToken";
import { PhoneXMarkIcon, XMarkIcon } from "@heroicons/react/16/solid";

export default function Call({ onClose, isOpen, targetUserIds, status, iceServers }) {
    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const peerConnections = useRef({});
    const iceCandidatesBuffer = useRef({}); // Buffer để lưu ICE candidates
    const [userId, setUserId] = useState(null);
    const [socket, setSocket] = useState(null);
    const [stream, setStream] = useState(null);
    const [callStatus, setCallStatus] = useState(status);

    const URL = `${process.env.REACT_APP_API_URL}`;
    useEffect(() => {
        if (targetUserIds) {
            connectSocket();
            startCall();
        }
    }, [targetUserIds]);

    useEffect(() => {
        if (isOpen) {
            const getMediaDevices = async () => {
                try {
                    const userStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true,
                    });
                    console.log("✅ [Media] Đã lấy stream thành công");
                    setStream(userStream);
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = userStream;
                    }
                } catch (err) {
                    console.error("❌ [Media] Lỗi lấy thiết bị media:", err);
                    alert("Không thể truy cập camera hoặc micro!");
                }
            };
            getMediaDevices();
        } else {
            cleanupMediaStream();
        }
    }, [isOpen]);

    const cleanupMediaStream = () => {
        if (stream) {
            console.log("🧹 [Media] Dọn dẹp stream");
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
    };

    useEffect(() => {
        if (!socket) return;

        socket.on("connect", () => {
            console.log("✅ [Socket] Kết nối WebSocket thành công");
            setCallStatus("calling");
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

        socket.on("incomingCall", ({ from, group }) => {
            console.log("📞 [Socket] Nhận incomingCall từ:", from, "group:", group);
            const accept = window.confirm(`📞 Cuộc gọi từ ${from}, chấp nhận?`);
            if (accept) {
                setCallStatus("in-call");
                acceptCall(from, group);
            } else {
                console.log("❌ [Socket] Gửi rejectCall tới:", from);
                socket.emit("rejectCall", { callerId: from });
            }
        });

        socket.on("callRejected", ({ from }) => {
            console.log("❌ [Socket] Nhận callRejected từ:", from);
            alert(`❌ Cuộc gọi từ ${from} đã bị từ chối`);
            cleanupPeer(from);
            setCallStatus("idle");
        });

        socket.on("callEnded", ({ from }) => {
            console.log("🚫 [Socket] Nhận callEnded từ:", from);
            alert(`🚫 Cuộc gọi kết thúc bởi ${from}`);
            cleanupPeer(from);
            setCallStatus("idle");
        });

        // socket.on("callUnavailable", ({ message }) => {
        //     console.log("❌ [Socket] Nhận callUnavailable:", message);
        //     alert(`❌ ${message}`);
        //     setCallStatus("idle");
        // });

        socket.on("offer", async ({ from, sdp }) => {
            console.log("📡 [Socket] Nhận offer từ:", from, "SDP:", sdp);
            try {
                if (!peerConnections.current[from]) {
                    peerConnections.current[from] = createPeerConnection(from);
                }
                await peerConnections.current[from].setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await peerConnections.current[from].createAnswer();
                await peerConnections.current[from].setLocalDescription(answer);
                console.log("📡 [Socket] Gửi answer tới:", from, "SDP:", answer);
                socket.emit("answer", { targetUserId: from, sdp: answer });

                // Xử lý ICE candidates trong buffer
                if (iceCandidatesBuffer.current[from]) {
                    for (const candidate of iceCandidatesBuffer.current[from]) {
                        console.log("❄️ [Socket] Xử lý ICE candidate từ buffer cho:", from, "Candidate:", candidate);
                        await peerConnections.current[from].addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    delete iceCandidatesBuffer.current[from];
                }
            } catch (error) {
                console.error("❌ [Socket] Lỗi xử lý offer:", error);
                cleanupPeer(from);
            }
        });

        socket.on("answer", async ({ from, sdp }) => {
            console.log("📡 [Socket] Nhận answer từ:", from, "SDP:", sdp);
            try {
                if (!peerConnections.current[from]) return;

                const pc = peerConnections.current[from];
                if (pc.signalingState !== "stable") {
                    console.warn(`⚠️ [Peer] Cannot set remote answer SDP in state: ${pc.signalingState}`);
                    return;
                }

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                // Xử lý ICE candidates trong buffer
                if (iceCandidatesBuffer.current[from]) {
                    for (const candidate of iceCandidatesBuffer.current[from]) {
                        console.log("❄️ [Socket] Xử lý ICE candidate từ buffer cho:", from, "Candidate:", candidate);
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    delete iceCandidatesBuffer.current[from];
                }
            } catch (error) {
                console.error("❌ [Socket] Lỗi xử lý answer:", error);
                cleanupPeer(from);
            }
        });

        socket.on("ice-candidate", async ({ from, candidate }) => {
            console.log("❄️ [Socket] Nhận ICE candidate từ:", from, "Candidate:", candidate);
            try {
                if (!peerConnections.current[from]) {
                    console.warn("⚠️ [Socket] PeerConnection cho", from, "chưa tồn tại");
                    return;
                }
                if (!peerConnections.current[from].remoteDescription) {
                    console.log("⏳ [Socket] Lưu ICE candidate vào buffer cho:", from);
                    if (!iceCandidatesBuffer.current[from]) iceCandidatesBuffer.current[from] = [];
                    iceCandidatesBuffer.current[from].push(candidate);
                    return;
                }
                await peerConnections.current[from].addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error("❌ [Socket] Lỗi xử lý ICE candidate:", error);
            }
        });

        // return () => {
        //     console.log("🧹 [Socket] Ngắt kết nối socket");
        //     socket.disconnect();
        //     setSocket(null);
        // };
    }, [socket, stream]);

    const connectSocket = () => {
        const token = authToken.getToken();
        if (!token) {
            console.error("❌ [Socket] Không tìm thấy token");
            return;
        }

        console.log("🔌 [Socket] Bắt đầu kết nối với token:", token);
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
        if (targetUserIds && socket && stream) {
            console.log("🔌 [Socket] Kết nối thành công với:", targetUserIds);
            startCall();
        }
    }, [socket, stream]);

    const createPeerConnection = (targetId) => {
        console.log("🔗 [Peer] Tạo PeerConnection với:", targetId);
        const pc = new RTCPeerConnection(iceServers);
        if (stream) {
            stream.getTracks().forEach((track) => {
                console.log("➕ [Peer] Thêm track vào PeerConnection:", track.kind);
                pc.addTrack(track, stream);
            });
        }
        pc.onicecandidate = (e) => {
            if (e.candidate && socket) {
                console.log("❄️ [Peer] Gửi ICE candidate tới:", targetId, "Candidate:", e.candidate);
                socket.emit("ice-candidate", { targetUserId: targetId, candidate: e.candidate });
            }
        };
        pc.ontrack = (e) => {
            console.log("📹 [Peer] Nhận stream từ:", targetId);
            if (!remoteVideoRefs.current[targetId]) {
                const container = document.createElement("div");
                const video = document.createElement("video");
                const label = document.createElement("p");
                label.textContent = `User: ${targetId}`;
                video.autoplay = true;
                video.playsInline = true;
                video.style.width = "200px";
                container.appendChild(video);
                container.appendChild(label);
                document.getElementById("remote-videos").appendChild(container);
                remoteVideoRefs.current[targetId] = video;
            }
            remoteVideoRefs.current[targetId].srcObject = e.streams[0];
        };
        pc.oniceconnectionstatechange = () => {
            console.log("🌐 [Peer] Trạng thái ICE của", targetId, ":", pc.iceConnectionState);
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
                console.log("❌ [Peer] Kết nối ICE thất bại với:", targetId);
                cleanupPeer(targetId);
            } else if (pc.iceConnectionState === "connected") {
                console.log("✅ [Peer] Kết nối ICE thành công với:", targetId);
            }
        };
        return pc;
    };
    const startCall = async () => {
        if (!targetUserIds || !socket || !stream) {
            console.log(targetUserIds, socket, stream);
            return;
        }
        const ids = targetUserIds.split(",").map((id) => id.trim());
        if (ids.length > 5) return alert("Tối đa 5 người trong nhóm");

        console.log("📞 [Socket] Gửi startCall tới:", ids);
        socket.emit("startCall", { targetUserIds: ids });

        for (const targetId of ids) {
            if (!peerConnections.current[targetId]) {
                peerConnections.current[targetId] = createPeerConnection(targetId);
                const offer = await peerConnections.current[targetId].createOffer();
                await peerConnections.current[targetId].setLocalDescription(offer);
                console.log("📡 [Socket] Gửi offer tới:", targetId, "SDP:", offer);
                socket.emit("offer", { targetUserId: targetId, sdp: offer });
            }
        }
    };

    const acceptCall = async (callerId, group) => {
        console.log("✅ [Call] Chấp nhận cuộc gọi từ:", callerId, "group:", group);
        group.forEach((id) => {
            if (id !== userId && !peerConnections.current[id]) {
                peerConnections.current[id] = createPeerConnection(id);
            }
        });
    };

    const endCall = () => {
        console.log("🚫 [Socket] Gửi endCall");
        Object.keys(peerConnections.current).forEach((targetId) => cleanupPeer(targetId));
        if (socket) socket.emit("endCall");
        cleanupMediaStream(); // Ensure media stream is cleaned up
        setCallStatus("idle");
        if (onClose) {
            onClose();
        }
    };

    const cleanupPeer = (targetId) => {
        console.log("🧹 [Peer] Dọn dẹp PeerConnection với:", targetId);
        if (peerConnections.current[targetId]) {
            peerConnections.current[targetId].close();
            delete peerConnections.current[targetId];
        }
        if (remoteVideoRefs.current[targetId]) {
            remoteVideoRefs.current[targetId].srcObject = null;
            remoteVideoRefs.current[targetId].parentElement.remove();
            delete remoteVideoRefs.current[targetId];
        }
        if (iceCandidatesBuffer.current[targetId]) {
            delete iceCandidatesBuffer.current[targetId];
        }
    };
    console.log("Trạng thái: ", callStatus);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className=" p-6 rounded-lg shadow-lg">

                {callStatus === "calling" && (
                    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-md">
                        <p>Đang gọi...</p>
                    </div>
                )}
                {callStatus === "in-call" && (
                    <div
                        id="remote-videos"
                        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", width: "100%", height: "100%" }}
                    ></div>
                )}
                {callStatus === "idle" && (
                    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-md">
                        <p>Cuộc gọi kết thúc</p>
                    </div>
                )}

                <div>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: "300px" }}
                        className="absolute bottom-3 right-3 rounded-md"
                    ></video>
                </div>
                <div>
                    {/* <input
                                    type="text"
                                    placeholder="Enter target user IDs (comma-separated)"
                                    value={targetUserIds}
                                    onChange={(e) => setTargetUserIds(e.target.value)}
                                    style={{ marginRight: "10px" }}
                                /> */}
                    {/* <button onClick={startCall} disabled={callStatus !== "connected"}>
                                    Start Call
                                </button> */}
                    {callStatus === "calling" && (
                        <button
                            className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-white rounded-full p-2"
                            onClick={endCall}
                            disabled={callStatus === "idle"}
                        >
                            <PhoneXMarkIcon className="h-10 w-10 text-red-600" />
                        </button>
                    )} {callStatus === "in-call" && (
                        <button
                            className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-white rounded-full p-2"
                            onClick={endCall}
                            disabled={callStatus === "idle"}
                        >
                            <PhoneXMarkIcon className="h-10 w-10 text-red-600" />
                        </button>
                    )}
                    {callStatus === "idle" && (
                        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2  flex gap-14">
                            <button
                                onClick={endCall}

                            >
                                <XMarkIcon className="h-14 w-14  bg-white cursor-pointer rounded-full text-red-600 p-1" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
