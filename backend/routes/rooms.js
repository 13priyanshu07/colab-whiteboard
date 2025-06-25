// routes/rooms.js
const express = require('express');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

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

// Check if room exists
router.get('/:id/exists', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({ 
        exists: false, 
        error: 'Valid room ID (non-empty string) is required' 
      });
    }

    const trimmedId = id.trim();
    const room = await Room.findById(trimmedId).select('_id owner').lean();

    if (!room) {
      return res.json({ 
        exists: false,
        message: 'Room not found'
      });
    }

    res.json({
      exists: true,
      room: {
        id: room._id,
        ownerId: room.owner,
        isOwner: req.user?.id === room.owner.toString()
      }
    });
    
  } catch (err) {
    console.error('Error checking room existence:', err);
    res.status(500).json({ exists: false, error: 'Server error checking room existence' });
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