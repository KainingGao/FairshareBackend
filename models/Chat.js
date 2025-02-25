//C:\Users\kygao\Documents\FairshareBackend\models\Chat.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { 
    type: String, 
    required: true,
    enum: ['user', 'assistant']
  },
  content: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const chatSchema = new mongoose.Schema({
  threadId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  messages: [messageSchema],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  }
});

module.exports = mongoose.model('Chat', chatSchema);