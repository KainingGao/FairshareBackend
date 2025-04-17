const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// =========================================
// PUBLIC ROUTES (Used by frontend)
// =========================================

// Get all blogs/posts with full content (public)
router.get('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    // We'll return unsorted data and let the frontend handle sorting
    // This gives more flexibility to the frontend
    const allBlogs = await blogs.find({}).toArray();
    res.json(allBlogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// =========================================
// ADMIN ROUTES (Hidden path)
// =========================================

// Create new blog/post for admin
router.post('/xyzadmin/posts', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    // Validate required fields
    const { title, content, category } = req.body;
    if (!title || !content || !category) {
      return res.status(400).json({ message: 'Title, content, and category are required' });
    }
    
    // Parse rank as integer, default to 0 if not provided or invalid
    let rank = 0;
    if (req.body.rank !== undefined) {
      rank = parseInt(req.body.rank, 10);
      if (isNaN(rank)) rank = 0;
    }
    
    const blog = {
      title,
      excerpt: req.body.excerpt || title.substring(0, 100) + '...',
      content,
      category,
      rank: rank,
      date: new Date(),
      updatedAt: new Date(),
      published: req.body.published !== undefined ? req.body.published : true,
    };
    
    const result = await blogs.insertOne(blog);
    res.status(201).json({
      message: 'Post created successfully',
      postId: result.insertedId,
      post: { _id: result.insertedId, ...blog }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Update blog/post for admin
router.put('/xyzadmin/posts/:id', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    // Prepare update data
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id; // Remove _id field if present
    
    const result = await blogs.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Get updated post
    const updatedPost = await blogs.findOne({ _id: new ObjectId(req.params.id) });
    
    res.json({
      message: 'Post updated successfully',
      post: updatedPost
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Delete blog/post for admin
router.delete('/xyzadmin/posts/:id', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    const result = await blogs.deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    res.json({
      message: 'Post deleted successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

module.exports = router;