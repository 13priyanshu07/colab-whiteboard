# Colab Whiteboard

A real-time collaborative whiteboard app with drawing tools, shape support, undo/clear sync, and live user tracking — built using React, Node.js, WebSockets, and MongoDB.

## Features

- 🎨 Pen, eraser, and shape tools (rectangle, circle, triangle, line)
- 🔄 Real-time sync across multiple users in a room
- 🧑‍🤝‍🧑 Live user count and tracking
- ↩️ Undo and clear canvas actions synchronized across users
- 💾 Auto-save and persistent canvas state using MongoDB
- 🪄 Smooth UI with live drawing preview and custom cursors

## Tech Stack

**Frontend:**
- React
- React Router
- React Toastify

**Backend:**
- Node.js
- Express
- Express-WS (WebSockets)
- MongoDB (Mongoose)
- JWT Authentication
- BcryptJS for password hashing
- Canvas for image processing
- UUID for unique identifiers

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB installed and running locally

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/13priyanshu07/colab-whiteboard.git
2. Open the terminal and write:
   ```bash
   cd backend
   node server.js
3. Now open another terminal and write:
   ```bash
   cd frontend
   npm start

