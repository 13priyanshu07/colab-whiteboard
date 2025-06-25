const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const fetchCanvas = async (roomId, canvasRef) => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/canvas`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.error('[fetchCanvas] Failed to fetch canvas');
      return;
    }

    const data = await res.json();
    if (data.canvasState && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        console.log('[fetchCanvas] Canvas restored from DB');
      };
      img.src = data.canvasState;
    }
  } catch (err) {
    console.error('[fetchCanvas] Error:', err);
  }
};

export const saveCanvasToDB = async (roomId, canvasData) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('User not authenticated');
  
  try {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/canvas`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ canvasState: canvasData })
    });

    if (response.ok) return await response.json(); // Success

    const errorData = await response.json();

    // If the room doesn't exist (likely 404), try creating the room
    if (response.status === 404) {
      console.log('[saveCanvasToDB] Room not found. Attempting to create room...');

      // Create the room with POST
      const createRoomRes = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          _id: roomId,
          canvasState: canvasData // Include initial canvas data
        }) // Your backend expects "roomId"
      });

      if (!createRoomRes.ok) {
        const createErr = await createRoomRes.json();
        throw new Error(createErr.error || 'Room creation failed');
      }

      return; // Return final result
    }
    // Other errors (not 404)
    throw new Error(errorData.message || 'Failed to save canvas');
  } catch (err) {
    console.error("SaveCanvasToDB Error:", err);
    throw err;
  }
};

export const loadCanvasFromDB = async (roomId) => {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/canvas`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  if (!response.ok) throw new Error('Failed to load canvas');
  return await response.json();
};