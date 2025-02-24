// server.js
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// Import routes
const blogRoutes = require('./routes/blogs');
const chatRoutes = require('./routes/chat');
const contactRoutes = require('./routes/contact'); // Add this line

// Middleware
app.use(cors());
app.use(express.json());

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
app.use('/api/contact', contactRoutes); // Add this line

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

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