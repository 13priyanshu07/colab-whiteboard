// src/components/RoomManager.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import WhiteboardSocket from '../services/WhiteboardSocket';

const RoomManager = ({ roomId, children }) => {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState(1);

  const handleSocketMessage = (data) => {
    console.log("📩 Received:", data);
    switch (data.type) {
      case 'INITIAL_STATE':
        if (data.payload?.roomInfo?.userCount !== undefined) {
          console.log("👥 Setting user count from INITIAL_STATE:", data.payload.roomInfo.userCount);
          setUsers(data.payload.roomInfo.userCount);
        }
        break;

      case 'ROOM_INFO':
        if (data.payload?.userCount !== undefined) {
          console.log("👥 Setting user count from ROOM_INFO:", data.payload.userCount);
          setUsers(data.payload.userCount);
        }
        break;

      case 'USER_COUNT_UPDATE':
        console.log("👥 Updating user count to:", data.count);
        setUsers(data.count);
        break;

      case 'ERROR':
        toast.error(data.message);
        break;

      default:
        break;
    }
  };

  useEffect(() => {
    console.log("room manager activated");
    try {
      const ws = new WhiteboardSocket(roomId, handleSocketMessage);
      setSocket(ws);
      return () => ws.close();
    } catch (err) {
      console.error("❌ Error in RoomManager useEffect:", err);
    }
  }, [roomId]);

  return (
    <div className="room-container">
      <div className="room-footer">
        <h3>Room ID: {roomId}</h3>
        <span>Users online: {users}</span>
      </div>
      {React.cloneElement(children, { socket, users: users, setUsers })}
    </div>
  );
};

export default RoomManager;