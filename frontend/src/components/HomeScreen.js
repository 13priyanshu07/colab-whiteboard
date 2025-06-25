import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeScreen.css';

const API_BASE_URL = 'http://localhost:5000/api/auth';

function HomeScreen() {
  const [roomId, setRoomId] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authModeSelected, setAuthModeSelected] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      fetch(`${API_BASE_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.username) {
            setUsername(data.username);
          } else {
            setUsername('User');
          }
        })
        .catch(() => setUsername('User'));
    }
  }, []);


  const toggleMode = () => {
    setIsLoginMode((prev) => !prev);
    setFormData({ username: '', email: '', password: '' });
    setError('');
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async () => {
    const url = isLoginMode ? `${API_BASE_URL}/login` : `${API_BASE_URL}/register`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('token', data.token);
   
      try {
        setIsLoggedIn(true);
        fetch(`${API_BASE_URL}/me`, {
          headers: {
            'Authorization': `Bearer ${data.token}`,
          },
        })
          .then(res => res.json())
          .then(data => {
            setUsername(data.username || 'User');
          })
          .catch(() => setUsername('User'));

      } catch (err) {
        setUsername('User');
      }
      alert('Authentication successful!');
    } catch (err) {
      setError(err.message);
    }
  };

  const createNewRoom = async() => {
    if (!localStorage.getItem('token')) return alert('Please login first.');

    const newRoomId = Math.random().toString(36).substring(2, 8);

    // Create the room in DB
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ _id: newRoomId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create room');
      }
      navigate(`/room/${newRoomId}`);
    } catch (err) {
      alert(`Room creation error: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUsername('');
    setAuthModeSelected(false);
  };


  const joinRoom = async () => {
    if (!localStorage.getItem('token')) return alert('Please login first.');
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) return alert('Please enter a room ID');

    try {
      // First check if room exists
      const existsRes = await fetch(`http://localhost:5000/api/rooms/${trimmedRoomId}/exists`);
      const existsData = await existsRes.json();
      
      if (!existsData.exists) {
        return alert('Room does not exist. Please check the ID or create a new room.');
      }

      // Room exists, proceed to join
      navigate(`/room/${trimmedRoomId}`);
    }catch (err) {
      console.error('Error checking room existence:', err);
      alert('Failed to verify room. Please try again.');
    }
  };

  return (
    <div className="home-screen">
      <div className="auth-container">
      {
        isLoggedIn?(
          <div>
            <h2>Welcome, {username}!</h2>
            <button className="auth-btn" onClick={handleLogout}>Logout</button>
          </div>
        ) : !authModeSelected ? (
          <>
            <button className="auth-btn" onClick={() => { setIsLoginMode(true); setAuthModeSelected(true); }}>
              Login
            </button>
            <button className="auth-btn" onClick={() => { setIsLoginMode(false); setAuthModeSelected(true); }}>
              Register
            </button>
          </>
        ) : (
          <>
            <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
            {!isLoginMode && (
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleInputChange}
              />
            )}
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
            />
            <button className="auth-btn" onClick={handleAuthSubmit}>
              {isLoginMode ? 'Login' : 'Register'}
            </button>
            {error && <p className="error-msg">{error}</p>}
            <p className="toggle-link" onClick={toggleMode}>
              {isLoginMode ? "Don't have an account? Register" : 'Already have an account? Login'}
            </p>
          </>
        )}
      </div>
      <div className="room-selection">
        <h1>Collaborative Whiteboard</h1>
        
        <button className="create-room-btn" onClick={createNewRoom}>
          Create New Room
        </button>
        
        <div className="join-room">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button className="join-room-btn" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomeScreen;