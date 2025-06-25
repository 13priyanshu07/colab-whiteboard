// src/WhiteboardSocket.js
class WhiteboardSocket {
  constructor(roomId, onMessage) {
    this.roomId = roomId;
    this.closedManually = false;
    this.onMessage = onMessage;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connect();
  }
  
  connect() {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close(1000, 'Reconnecting');
    }
    this.socket = new WebSocket(`ws://localhost:5000/whiteboard/${this.roomId}`);
    console.log('🔌 WebSocket connection created for room:', this.roomId);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      if (!event.wasClean && !this.closedManually && this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
          this.connect();
        }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  sendDrawAction(drawData) {
    this.send({
      type: 'DRAW',
      payload: drawData
    });
  }
  
  send(data) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));   
    } else if (this.socket.readyState === WebSocket.CONNECTING) {
      setTimeout(() => this.send(data), 100);
    } else {
      console.warn('WebSocket not ready. State:', this.socket.readyState);
    }
  }

  saveCanvas(canvasData) {
    this.send({
      type: 'SAVE_CANVAS',
      payload: canvasData
    });
  }
  
  close() {
    console.log("Socket closed");
    this.closedManually = true;
    this.socket.close(1000, 'Normal Closure');
  }
}

export default WhiteboardSocket;