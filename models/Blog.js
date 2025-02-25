//C:\Users\kygao\Documents\FairshareBackend\models\Blog.js
const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  excerpt: { 
    type: String, 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  published: {
    type: Boolean,
    default: true
  },
  slug: {
    type: String,
    unique: true
  },
  author: {
    type: String,
    default: 'Admin'
  },
  tags: [String],
  date: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date
  },
  viewCount: {
    type: Number,
    default: 0
  }
});

// Pre-save hook to generate slug if not provided
blogSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  }
  
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Blog', blogSchema);