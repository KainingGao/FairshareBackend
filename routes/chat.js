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

// Handle API error helper function
const handleApiError = (error, res) => {
  console.error('API Error:', error);
  const status = error.status || 500;
  const message = error.message || 'An unknown error occurred';
  res.status(status).json({
    error: true,
    message,
    details: error.response?.data || {}
  });
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
router.get('/assistant/:assistantId', async (req, res) => {
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
router.post('/assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;
    
    // Validate assistant ID
    if (!assistantId) {
      return res.status(400).json({ message: 'Assistant ID is required' });
    }
    
    // Extract assistant parameters
    const updateParams = { ...req.body };
    
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
// ADMIN ROUTES (Hidden path)
// =========================================

// Get all chats with full details for admin (no pagination)
router.get('/xyzadmin/chats', async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const chats = database.collection('chats');
    
    // Get all chats without pagination
    const chatList = await chats.find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(chatList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

module.exports = router;