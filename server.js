//C:\Users\kygao\Documents\FairshareBackend\server.js
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const OpenAI = require('openai');
const contactRoutes = require('./routes/contact');

require('dotenv').config();

const app = express();

// Import routes
const blogRoutes = require('./routes/blogs');
const chatRoutes = require('./routes/chat');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/contact', contactRoutes);

// MongoDB Setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
    return client.db("fairshare"); // Use this database for operations
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Wake-up endpoint
app.get('/wake-up', (req, res) => {
  res.json({ status: 'Server is awake' });
});

// Use routes
app.use('/api/blogs', blogRoutes);
app.use('/api/chat', chatRoutes);
app.use()

// Start server only after DB connection
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});