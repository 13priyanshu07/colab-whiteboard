# Realtime Whiteboard

A real-time collaborative whiteboard app with drawing tools, shape support, undo/clear sync, and live user tracking — built using React, Node.js, WebSockets, and MongoDB.

## Features

- 🎨 Pen, eraser, and shape tools (rectangle, circle, triangle, line)
- 🔄 Real-time sync across multiple users in a room
- 🧑‍🤝‍🧑 Live user count and tracking
- ↩️ Undo and clear canvas actions synchronized across users
- 💾 Auto-save and persistent canvas state using MongoDB
- 🪄 Smooth UI with live drawing preview and custom cursors

## Tech Stack

- **Frontend:** React, WebSockets
- **Backend:** Express.js, Node.js, MongoDB
- **Database:** MongoDB (stores room metadata and canvas state)

## Getting Started

### Prerequisites

- Node.js (v16+)
- MongoDB installed and running locally

### Setup

#### 1. Clone the repo

```bash
git clone https://github.com/your-username/realtime-whiteboard.git
cd realtime-whiteboard