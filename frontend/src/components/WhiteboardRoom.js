import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Whiteboard from './Whiteboard';
import RoomManager from './RoomManager';

function WhiteboardRoom() {
  const { roomId } = useParams();
  console.log("WhiteboardRoom mounted with roomId:", roomId); // Add this


  useEffect(() => {
    document.title = `Whiteboard Room: ${roomId}`;
  }, [roomId]);

  return (
    <RoomManager roomId={roomId}>
      <Whiteboard roomId={roomId}/>
    </RoomManager>
  );
}

export default WhiteboardRoom;