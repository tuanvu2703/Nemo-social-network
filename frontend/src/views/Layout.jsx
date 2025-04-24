import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Navbar from "./navbar/navBar";
import authToken from "../components/authToken";
import { useEffect, useState, useRef } from "react";
import { UserProvider } from "../service/UserContext";
import socket from "../service/webSocket/socket";
import { toast } from "react-toastify";
import NotificationCss from "../module/cssNotification/NotificationCss";
import imgUser from "../img/user.png";
import { profileUserCurrent } from "../service/ProfilePersonal";
import SideBar from "./sidebar/SideBar";
import { ToastContainer } from "react-toastify";
import Call from "../components/Call";
import { CallProvider, useCall } from "../components/CallContext";

// Main Layout component
export default function Layout() {
  return (
    <UserProvider>
      <CallProvider>
        <LayoutContent />
      </CallProvider>
    </UserProvider>
  );
}

// Inner component that uses the call context
function LayoutContent() {
  const navigate = useNavigate();
  const [userCurrent, setUserCurrent] = useState({});
  const [disconnect, setDisconnect] = useState(true);
  const { callState, acceptIncomingCall, endCall } = useCall();
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);

  useEffect(() => {
    if (disconnect === true) {
      socket.on("connect", () => {
        console.log("✅ [Socket] Connected to WebSocket server with ID:", socket.id);
        setDisconnect(false);
      });
      socket.on("connect_error", (err) => {
        console.error("❌ [Socket] Lỗi kết nối:", err.message);
      });
    } else {
      socket.on("disconnect", () => {
        console.log("❌ [Socket] Disconnected from server");
        setDisconnect(true);
      });
    }
  }, [disconnect]);

  const getDataUser = async () => {
    try {
      const response = await profileUserCurrent();
      if (response && response.data) {
        setUserCurrent(response.data);
      } else {
        console.warn("No data found in response.");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    if (!authToken.getToken()) {
      navigate("/login");
      return;
    }
    getDataUser();
  }, [navigate]);

  // Handle incoming calls
  useEffect(() => {
    // Set up incomingCall handler
    socket.on("incomingCall", ({ from, group }) => {
      console.log("📞 [Socket] Nhận incomingCall từ:", from, "group:", group);
      // Store incoming call data and show confirmation
      setIncomingCallData({ from, group });
      setShowCallConfirm(true);
    });

    // Set up callRejected handler
    socket.on("callRejected", ({ from }) => {
      console.log("❌ [Socket] Nhận callRejected từ:", from);
      toast.error(`Cuộc gọi bị từ chối bởi ${from}`, NotificationCss.Fail);
      endCall(); // Close the call modal
    });

    // Cleanup event listeners
    return () => {
      socket.off("incomingCall");
      socket.off("callRejected");
    };
  }, [endCall]);

  // Handle call acceptance
  const handleAcceptCall = () => {
    if (incomingCallData) {
      acceptIncomingCall(incomingCallData.from, incomingCallData.group);
      setShowCallConfirm(false);
      setIncomingCallData(null);
    }
  };

  // Handle call rejection
  const handleRejectCall = () => {
    if (incomingCallData) {
      console.log("❌ [Socket] Gửi rejectCall tới:", incomingCallData.from);
      socket.emit("rejectCall", { callerId: incomingCallData.from });
      setShowCallConfirm(false);
      setIncomingCallData(null);
    }
  };

  useEffect(() => {
    socket.on("newmessage", (newMessage) => {
      if (String(newMessage.sender._id) !== String(userCurrent._id) && newMessage.sender._id && userCurrent._id) {
        toast.success(
          <a href={`/messenger/inbox/?iduser=${newMessage.sender._id}`}>
            <div className="w-full flex flex-row">
              <div className="w-full flex items-center space-x-3">
                <a>
                  <img
                    src={newMessage?.sender?.avatar ? newMessage.sender.avatar : imgUser}
                    alt="user"
                    className="w-12 h-12 rounded-full mr-2 border-white border-2"
                  />
                </a>
                <div className="text-start">
                  <h3
                    className="font-semibold truncate w-[110px] overflow-hidden whitespace-nowrap"
                    title={newMessage ? `${newMessage?.sender?.lastName || ''} ${newMessage?.sender?.firstName || ''}`.trim() : "No Name"}
                  >
                    {newMessage ? `${newMessage?.sender?.lastName || ''} ${newMessage?.sender?.firstName || ''}`.trim() : "No Name"}
                  </h3>
                </div>
              </div>
            </div>
            <div className="line-clamp-2 overflow-hidden text-ellipsis" title={newMessage?.content}>
              {newMessage ? newMessage.content : ''}
            </div>
          </a>,
          NotificationCss.Mess
        );
      }
    });

    socket.on("newmessagetogroup", (newMessage) => {
      if (String(newMessage.sender._id) !== String(userCurrent._id) && newMessage.sender._id && userCurrent._id) {
        toast.success(
          <a href={`/messenger/group/?idgroup=${String(newMessage.forGroup)}`}>
            <p className="text-xs text-gray-400 mb-2 font-semibold text-nowrap overflow-hidden text-ellipsis max-w-20">
              Tin Nhóm
            </p>
            <div className="w-full flex flex-row">
              <div className="w-full flex items-center space-x-3">
                <a>
                  <img
                    src={newMessage?.sender?.avatar ? newMessage.sender.avatar : imgUser}
                    alt="user"
                    className="w-12 h-12 rounded-full mr-2 border-white border-2"
                  />
                </a>
                <div className="text-start">
                  <h3
                    className="font-semibold truncate w-[110px] overflow-hidden whitespace-nowrap"
                    title={newMessage ? `${newMessage?.sender?.lastName || ''} ${newMessage?.sender?.firstName || ''}`.trim() : "No Name"}
                  >
                    {newMessage ? `${newMessage?.sender?.lastName || ''} ${newMessage?.sender?.firstName || ''}`.trim() : "No Name"}
                  </h3>
                </div>
              </div>
            </div>
            <div className="line-clamp-2 text-xs text-gray-400 overflow-hidden text-ellipsis" title={newMessage?.content}>
              Nhắn:{newMessage ? newMessage.content : ''}
            </div>
          </a>,
          NotificationCss.Mess
        );
      }
    });

    return () => {
      socket.off("newmessage");
      socket.off("newmessagetogroup");
    };
  }, [userCurrent]);

  const [isMessengerPath, SetIsMessengerPath] = useState(true);
  const location = useLocation();
  useEffect(() => {
    SetIsMessengerPath(/^\/messenger(\/|$)/.test(location.pathname));
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      <Navbar />
      <div className="navbar"></div>
      <div className="container mx-auto flex">
        {isMessengerPath ? (
          <div className="hidden md:block">
            <SideBar />
          </div>
        ) : (
          <div className="hidden md:block md:w-1/4 lg:w-1/5 xl:w-1/4">
            <SideBar />
          </div>
        )}
        <main className="bg-background w-full">
          <Outlet />
          <ToastContainer position="bottom-left" autoClose={3000} />
        </main>
      </div>

      {/* Call Confirmation Dialog */}
      {showCallConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Cuộc gọi đến</h3>
            <p className="mb-6">
              Bạn có cuộc gọi từ {incomingCallData?.from}. Bạn có muốn chấp nhận không?
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleRejectCall}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Từ chối
              </button>
              <button
                onClick={handleAcceptCall}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Chấp nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Call Component */}
      {callState.isOpen && (
        <Call
          isOpen={callState.isOpen}
          targetUserIds={callState.targetUserIds}
          status={callState.status}
          onClose={endCall}
        />
      )}
    </div>
  );
}