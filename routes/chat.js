import express from 'express';
import OpenAI from 'openai';
import { Chat } from '../models/Chat.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Create new thread
router.post('/thread', async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    const chat = new Chat({ threadId: thread.id });
    await chat.save();
    res.json({ threadId: thread.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send message and get response
router.post('/message', async (req, res) => {
  const { threadId, message } = req.body;

  try {
    // Save user message to database
    const chat = await Chat.findOne({ threadId });
    if (!chat) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    chat.messages.push({
      role: 'user',
      content: message
    });

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
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessage = messages.data[0].content[0].text.value;

    // Save assistant message to database
    chat.messages.push({
      role: 'assistant',
      content: assistantMessage
    });
    await chat.save();

    res.json({ message: assistantMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get chat history
router.get('/history/:threadId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ threadId: req.params.threadId });
    if (chat) {
      res.json(chat.messages);
    } else {
      res.status(404).json({ message: 'Chat history not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export const chatRouter = router;