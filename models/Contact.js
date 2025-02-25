// models/Contact.js

const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'replied', 'closed'],
    default: 'new'
  },
  replied: {
    type: Boolean,
    default: false
  },
  replies: [{
    subject: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date
  },
  lastReplied: {
    type: Date
  }
});

module.exports = mongoose.model('Contact', contactSchema);