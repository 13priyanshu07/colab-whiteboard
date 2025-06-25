import React, { useRef, useState, useEffect } from 'react';
import penCursor from '../cursors/pen-cursor.png';
import eraserCursor from '../cursors/eraser-cursor.png';
import { fetchCanvas, saveCanvasToDB } from '../api/WhiteboardApi';

function Whiteboard({ socket, roomId, setUsers }) {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [penWidth, setPenWidth] = useState(2); // Stores user's pen width
  const [eraserWidth, setEraserWidth] = useState(20); //Stores user's eraser width
  const [shape, setShape] = useState(null); // e.g. 'rectangle', 'circle', etc.
  const [startPos, setStartPos] = useState({ x: 0, y: 0 }); 
  const [history, setHistory] = useState([]);
  const [lastSaveTime, setLastSaveTime] = useState(0);
  const autoSaveInterval = 1000; // Save every second

  // Continuous auto-save effect
  useEffect(() => {
    const autoSave = setInterval(() => {
      if (Date.now() - lastSaveTime > autoSaveInterval) {
        saveCanvasConstant();
      }
    }, 1000); // Check every second

    return () => clearInterval(autoSave);
  }, [lastSaveTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const handleResize = () => {
      const oldData = canvas.toDataURL(); 
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const img = new Image();
      img.onload = () => context.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = oldData;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchCanvas(roomId, canvasRef);
  }, [roomId]);


  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDrawing = (data) => {
      const canvas = canvasRef.current; 
      const ctx = canvasRef.current.getContext('2d');
      switch(data.type){
        case 'INITIAL_STATE':
          if (data.payload?.roomInfo?.userCount !== undefined) {
            console.log("👥 Setting user count from INITIAL_STATE:", data.payload.roomInfo.userCount);
            setUsers(data.payload.roomInfo.userCount);
          }
          break;
        case 'USER_COUNT_UPDATE':
          console.log("👥 Updating user count to:", data.count);
          setUsers(data.count);
          break;
        case 'DRAW_START':
          drawFromData(data, ctx);
          break;
        case 'DRAW':
          drawFromData(data, ctx);
          break;
        case 'UNDO':
          console.log("going back");
          undo(false, canvas);
          break;
        case 'CLEAR_CANVAS':
          clearCanvas(false, canvas);
          break;
        default:
          break;
      }
    };

    socket.onMessage = handleRemoteDrawing;

    socket.send({ type: 'REQUEST_STATE' });

    return () => {
      socket.onMessage = null;
    };
  }, [socket]);


  // Constant save function
  const saveCanvasConstant = async () => {
    try {
      const image = canvasRef.current.toDataURL('image/png');     
      // Parallel save to MongoDB and WebSocket
      await Promise.all([
        saveCanvasToDB(roomId, image),
        socket?.saveCanvas(image)
      ]);
      
      setLastSaveTime(Date.now());
    } catch (error) {
      console.error('Save failed:', error);
      // Retry after delay if needed
      setTimeout(saveCanvas, 2000); 
    }
  };

  const drawFromData = (data, ctx) => {
    const drawData = data.payload;
    ctx.strokeStyle = drawData.color;
    ctx.lineWidth = drawData.lineWidth;

    if (data.type === 'DRAW_START') {
      ctx.beginPath();
      ctx.moveTo(drawData.startPos.x, drawData.startPos.y);
    }
    
    else if (drawData.tool === 'pen' || drawData.tool === 'eraser') {
      ctx.lineTo(drawData.currentPos.x, drawData.currentPos.y);
      ctx.stroke();
    } 
    else if (drawData.tool === 'shape') {
      const { startPos, currentPos } = drawData;
      
      switch (drawData.shape) {
        case 'rectangle':
          ctx.strokeRect(startPos.x, startPos.y, 
                        currentPos.x - startPos.x, 
                        currentPos.y - startPos.y);
          break;
        case 'circle':
          const radius = Math.sqrt((currentPos.x - startPos.x) ** 2 + 
                                (currentPos.y - startPos.y) ** 2);
          ctx.beginPath();
          ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(currentPos.x, currentPos.y);
          ctx.stroke();
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(currentPos.x, currentPos.y);
          ctx.lineTo(startPos.x - (currentPos.x - startPos.x), currentPos.y);
          ctx.closePath();
          ctx.stroke();
          break;
        default:
          break;
      }
    }
  };

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    const context = canvasRef.current.getContext('2d');

    if (tool === 'shape') {
      setStartPos({ x: offsetX, y: offsetY });
      setIsDrawing(true);
    } else {
      setStartPos({ x: offsetX, y: offsetY });
      context.beginPath();
      context.moveTo(offsetX, offsetY);
      context.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      context.lineWidth = lineWidth;
      setIsDrawing(true);
      // Send path initiation to other clients
      if (socket) {
        socket.send({
          type: 'DRAW_START',
          payload: {
            tool,
            color: tool === 'eraser' ? '#FFFFFF' : color,
            lineWidth,
            startPos: { x: offsetX, y: offsetY }
          }
        });
      }
    }
  };

  const draw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;

    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const previewCtx = previewCanvasRef.current.getContext('2d');

    if (tool === 'shape') {
      previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);

      const { x, y } = startPos;
      previewCtx.strokeStyle = color;
      previewCtx.lineWidth = lineWidth;

      if (shape === 'rectangle') {
        previewCtx.strokeRect(x, y, offsetX - x, offsetY - y);
      } else if (shape === 'circle') {
        const radius = Math.sqrt((offsetX - x) ** 2 + (offsetY - y) ** 2);
        previewCtx.beginPath();
        previewCtx.arc(x, y, radius, 0, 2 * Math.PI);
        previewCtx.stroke();
      } else if (shape === 'line') {
        previewCtx.beginPath();
        previewCtx.moveTo(x, y);
        previewCtx.lineTo(offsetX, offsetY);
        previewCtx.stroke();
      } else if (shape === 'triangle') {
        previewCtx.beginPath();
        previewCtx.moveTo(x, y);
        previewCtx.lineTo(offsetX, offsetY);
        previewCtx.lineTo(x - (offsetX - x), offsetY);
        previewCtx.closePath();
        previewCtx.stroke();
      }

    } else {
      ctx.lineTo(offsetX, offsetY);
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Send incremental drawing data
      if (socket) {
        console.log("drawing");
        socket.send({
          type: 'DRAW',
          payload: {
            tool,
            color: tool === 'eraser' ? '#FFFFFF' : color,
            lineWidth,
            currentPos: { x: offsetX, y: offsetY }
          }
        });
      }
    }
  };

  const stopDrawing = ({ nativeEvent }) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const { offsetX, offsetY } = nativeEvent;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = startPos;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (tool === 'shape') {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      if (shape === 'rectangle') {
        ctx.strokeRect(x, y, offsetX - x, offsetY - y);
      } else if (shape === 'circle') {
        const radius = Math.sqrt((offsetX - x) ** 2 + (offsetY - y) ** 2);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
      } else if (shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(offsetX, offsetY);
        ctx.lineTo(x - (offsetX - x), offsetY);
        ctx.closePath();
        ctx.stroke();
      }
      if (socket) {
        socket.sendDrawAction({
          tool: tool,
          shape: shape, 
          color: color,
          lineWidth: lineWidth,
          startPos: { x, y },
          currentPos: { x: offsetX, y: offsetY }
        });
      }
    }

    previewCanvasRef.current.getContext('2d').clearRect(
      0, 0,
      previewCanvasRef.current.width,
      previewCanvasRef.current.height
    );

    setHistory([...history, canvas.toDataURL()]);
  };

  const saveCanvas = async () => {
    try{
      const image = canvasRef.current.toDataURL('image/png');
      if (socket) {
        socket.saveCanvas(image);
      }
      await fetch('http://localhost:5000/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
    }catch(err){
      console.log(err);
    }
  };

  const loadCanvas = async () => {
    const res = await fetch('http://localhost:5000/load');
    if (!res.ok) return;

    const blob = await res.blob();
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = URL.createObjectURL(blob);
  };

  const clearCanvas = (shouldBroadcast = true, canvas=canvasRef.current) => {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (shouldBroadcast && socket) {
      socket.send({type: 'CLEAR_CANVAS'});
    }
  };

  const undo = (shouldBroadcast = true, canvas=canvasRef.current) => {
    if (history.length === 0) return;
    const imgData = history[history.length - 2];
    const context = canvas.getContext('2d');
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
    };
    image.src = imgData;
    setHistory(history.slice(0, -1));
    if (shouldBroadcast && socket) {
      socket.send({type: 'UNDO'});
    }
  };

  const getCursor = () => {
    if (tool === 'pen') {
      return `url(${penCursor}) 4 28, crosshair`;
    } else if (tool === 'eraser') {
      return `url(${eraserCursor}) 4 28, auto`;
    } else {
      return 'crosshair'; 
    }
  };

  const canvasStyle = {
    cursor: getCursor(),
    position: 'absolute',
    top: '60px',
    left: 0,
    display: 'block',
    zIndex: 0
  };


  return (
    <div className="App">
      <div className="toolbar">
        <div className="tool-buttons">
          <button
            className={`tool-button ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => {
              setTool('pen');
              setShape(null);
              setLineWidth(penWidth);
            }}
            title="Use the Pen Tool"
          >
            ✏️ Pen
          </button>

          <button
            className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => {
              setTool('eraser');
              setShape(null);
              setLineWidth(eraserWidth);
            }}
            title="Use the Eraser Tool"
          >
            🧽 Eraser
          </button>
          <label>
            <select
              value={shape || ''}
              onChange={(e) => {
                setTool('shape');
                setShape(e.target.value);
              }}
            >
              <option value="">Shapes</option>
              <option value="rectangle">▭ Rectangle</option>
              <option value="triangle">▲ Triangle</option>
              <option value="circle">◯ Circle</option>
              <option value="line">／ Line</option>
            </select>
          </label>
        </div>
        <label>Color:
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>Width:
          <input type="range" min="1" max="25" value={lineWidth} onChange={(e) => {
            const newWidth=e.target.value;
            setLineWidth(newWidth);
            if(tool === 'pen'){
              setPenWidth(newWidth);
            }else if(tool === 'eraser'){
              setEraserWidth(newWidth);
            }
          }} />
        </label>
        <button onClick={undo}>Undo</button>
        <button onClick={clearCanvas}>Clear</button>
        <button onClick={saveCanvas}>Save</button>
        <button onClick={loadCanvas}>Load</button>
      </div>
      <canvas
        ref={previewCanvasRef}
        className="preview-canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          position: 'absolute',
          top: "60px",
          left: 0,
          zIndex: 0,
          pointerEvents: 'none' // Makes sure mouse events go through
        }}
      />

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        style={canvasStyle}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={() => setIsDrawing(false)}
      />
    </div>
  );
}

export default Whiteboard;