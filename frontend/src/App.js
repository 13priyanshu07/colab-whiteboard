import React from 'react';
import { BrowserRouter, Routes, Route} from 'react-router-dom';
import HomeScreen from './components/HomeScreen';
import WhiteboardRoom from './components/WhiteboardRoom';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/room/:roomId" element={<WhiteboardRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;