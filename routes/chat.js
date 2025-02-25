//C:\Users\kygao\Documents\FairshareBackend\routes\chat.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create helper function to handle errors consistently
const handleApiError = (error, res) => {
  console.error('API Error:', error);
  
  // Return the appropriate error status and message
  const status = error.status || 500;
  const message = error.message || 'An unknown error occurred';
  
  res.status(status).json({
    error: true,
    message,
    details: error.response?.data || {}
  });
};

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

// Create new thread
router.post('/thread', async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    await chats.insertOne({
      threadId: thread.id,
      messages: [],
      createdAt: new Date()
    });
    res.json({ threadId: thread.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Send message and get response
router.post('/message', async (req, res) => {
  const { threadId, message } = req.body;

  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // Save user message
    await chats.updateOne(
      { threadId },
      { 
        $push: { 
          messages: {
            role: 'user',
            content: message,
            timestamp: new Date()
          }
        }
      }
    );

    // Send message to OpenAI
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID
    });

    // Wait for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      if (runStatus.status === 'failed') {
        throw new Error('Assistant run failed');
      }
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessage = messages.data[0].content[0].text.value;

    // Save assistant message
    await chats.updateOne(
      { threadId },
      { 
        $push: { 
          messages: {
            role: 'assistant',
            content: assistantMessage,
            timestamp: new Date()
          }
        }
      }
    );

    res.json({ message: assistantMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get chat history for a specific thread
router.get('/history/:threadId', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    const chat = await chats.findOne({ threadId: req.params.threadId });
    if (chat) {
      res.json(chat.messages);
    } else {
      res.status(404).json({ message: 'Chat history not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get all threads (list view)
router.get('/threads', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // Find all documents and convert to array
    const threads = await chats.find({}).toArray();
    
    if (threads.length > 0) {
      // Return array of threads with their IDs
      res.json(threads.map(thread => ({
        threadId: thread.threadId,
        createdAt: thread.createdAt,
        messageCount: thread.messages.length
      })));
    } else {
      res.status(404).json({ message: 'No threads found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// =========================================
// ASSISTANT MANAGEMENT ROUTES
// =========================================

// Retrieve assistant details
router.get('/assistant/:assistantId', validateApiKey, async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    // Validate assistant ID
    if (!assistantId) {
      return res.status(400).json({ message: 'Assistant ID is required' });
    }
    
    // Retrieve the assistant from OpenAI
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    res.json(assistant);
  } catch (error) {
    handleApiError(error, res);
  }
});

// Modify assistant
router.post('/assistant/:assistantId', validateApiKey, async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    // Validate assistant ID
    if (!assistantId) {
      return res.status(400).json({ message: 'Assistant ID is required' });
    }
    
    // Extract assistant parameters
    const updateParams = { ...req.body };
    delete updateParams.apiKey; // Remove API key if present
    
    // Update the assistant
    const updatedAssistant = await openai.beta.assistants.update(
      assistantId,
      updateParams
    );
    
    res.json(updatedAssistant);
  } catch (error) {
    handleApiError(error, res);
  }
});

// =========================================
// ADMIN ROUTES (Hidden path with API key validation)
// =========================================

// Get all chats with full details for admin
router.get('/admin/chats', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Find all documents with pagination
    const totalChats = await chats.countDocuments();
    const chatList = await chats.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    res.json({
      data: chatList,
      pagination: {
        total: totalChats,
        page,
        limit,
        pages: Math.ceil(totalChats / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get specific chat detail for admin
router.get('/admin/chats/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // First try to find by ObjectId
    let chat;
    try {
      chat = await chats.findOne({ _id: new ObjectId(req.params.id) });
    } catch (e) {
      // If not ObjectId, try to find by threadId
      chat = await chats.findOne({ threadId: req.params.id });
    }
    
    if (chat) {
      res.json(chat);
    } else {
      res.status(404).json({ message: 'Chat not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Delete chat for admin
router.delete('/admin/chats/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // First try to delete by ObjectId
    let result;
    try {
      result = await chats.deleteOne({ _id: new ObjectId(req.params.id) });
    } catch (e) {
      // If not ObjectId, try to delete by threadId
      result = await chats.deleteOne({ threadId: req.params.id });
    }
    
    if (result.deletedCount > 0) {
      res.json({ message: 'Chat deleted successfully', result });
    } else {
      res.status(404).json({ message: 'Chat not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Delete multiple chats for admin
router.post('/admin/chats/delete-multiple', validateApiKey, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide valid chat IDs' });
    }
    
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // Try to convert ids to ObjectIds, fallback to original id if not possible
    const objectIds = ids.map(id => {
      try {
        return new ObjectId(id);
      } catch (e) {
        return id;
      }
    });
    
    // Delete by _id or threadId
    const result = await chats.deleteMany({
      $or: [
        { _id: { $in: objectIds.filter(id => id instanceof ObjectId) } },
        { threadId: { $in: ids.filter(id => typeof id === 'string') } }
      ]
    });
    
    res.json({ 
      message: `${result.deletedCount} chats deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

module.exports = router;