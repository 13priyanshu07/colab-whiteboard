// routes/rooms.js
const express = require('express');
const Room = require('../models/Room');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

// Create a room
router.post('/', auth, async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({ error: 'roomId is required' });
    }
    const existingRoom = await Room.findById(_id);
    if (existingRoom) {
      return res.status(400).json({ error: 'Room ID already exists' });
    }
    const room = new Room({
      _id,
      owner: req.user.id,
      users: [req.user.id]
    });
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all rooms for a user
router.get('/:id/canvas', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    res.json({ canvasState: room.canvasState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save canvas state
router.put('/:id/canvas', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { canvasState } = req.body;

    if (!canvasState || typeof canvasState !== 'string' || !canvasState.startsWith('data:image/')) {
      console.log('[PUT /:id/canvas] Invalid canvasState (check failed):', canvasState?.slice?.(0, 50));
      return res.status(400).json({ error: 'Invalid canvas data' });
    }

    const updatedRoom = await Room.findByIdAndUpdate(
      id.trim(),
      {
        $set: { canvasState },
        $addToSet: { users: req.user.id }
      },
      { new: true }
    );
    if (!updatedRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      message: 'Canvas state & users array updated successfully',
      room: updatedRoom
    });
    // room.canvasState = canvasState;
    // await room.save();
  } catch (err) {
    console.error('Canvas update error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;