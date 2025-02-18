const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Get all blogs
router.get('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    const allBlogs = await blogs.find({}).toArray();
    res.json(allBlogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Create new blog
router.post('/', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    const blog = {
      title: req.body.title,
      excerpt: req.body.excerpt,
      content: req.body.content,
      category: req.body.category,
      date: new Date()
    };
    const result = await blogs.insertOne(blog);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Update blog
router.put('/:id', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    const result = await blogs.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Delete blog
router.delete('/:id', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const blogs = database.collection('blogs');
    const result = await blogs.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

module.exports = router;