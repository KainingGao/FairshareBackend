//C:\Users\kygao\Documents\FairshareBackend\routes\chat.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

// Get chat history
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

// Get all threads
router.get('/history/threads', async (req, res) => {
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


module.exports = router;