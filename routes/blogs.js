//C:\Users\kygao\Documents\FairshareBackend\routes\blogs.js
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Validate API key middleware for admin routes
const validateApiKey = (req, res, next) => {
  const apiKey = req.body.apiKey || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.BACKEND_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// =========================================
// PUBLIC ROUTES (Used by frontend)
// =========================================

// Get all blogs/posts (public)
router.get('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    const allBlogs = await blogs.find({})
      .sort({ date: -1 })
      .toArray();
    res.json(allBlogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get single blog/post by ID (public)
router.get('/:id', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    let blog;
    try {
      blog = await blogs.findOne({ _id: new ObjectId(req.params.id) });
    } catch (e) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (blog) {
      res.json(blog);
    } else {
      res.status(404).json({ message: 'Post not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// =========================================
// ADMIN ROUTES (Hidden path with API key validation)
// =========================================

// Get all blogs/posts with pagination for admin
router.get('/admin/posts', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filtering options
    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { content: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Find all documents with filtering and pagination
    const totalPosts = await blogs.countDocuments(filter);
    const postList = await blogs.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    res.json({
      data: postList,
      pagination: {
        total: totalPosts,
        page,
        limit,
        pages: Math.ceil(totalPosts / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get post categories for admin
router.get('/admin/categories', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    const categories = await blogs.distinct('category');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get single blog/post by ID for admin
router.get('/admin/posts/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    let blog;
    try {
      blog = await blogs.findOne({ _id: new ObjectId(req.params.id) });
    } catch (e) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (blog) {
      res.json(blog);
    } else {
      res.status(404).json({ message: 'Post not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Create new blog/post for admin
router.post('/admin/posts', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    // Validate required fields
    const { title, content, category } = req.body;
    if (!title || !content || !category) {
      return res.status(400).json({ message: 'Title, content, and category are required' });
    }
    
    const blog = {
      title,
      excerpt: req.body.excerpt || title.substring(0, 100) + '...',
      content,
      category,
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
router.put('/admin/posts/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    // Prepare update data
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id; // Remove _id field if present
    delete updateData.apiKey; // Remove apiKey field
    
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
router.delete('/admin/posts/:id', validateApiKey, async (req, res) => {
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

// Delete multiple blogs/posts for admin
router.post('/admin/posts/delete-multiple', validateApiKey, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide valid post IDs' });
    }
    
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    
    // Convert string ids to ObjectIds
    const objectIds = ids.map(id => new ObjectId(id));
    
    const result = await blogs.deleteMany({ _id: { $in: objectIds } });
    
    res.json({ 
      message: `${result.deletedCount} posts deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

module.exports = router;