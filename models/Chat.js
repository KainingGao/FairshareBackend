//C:\Users\kygao\Documents\FairshareBackend\models\Chat.js
const messageSchema = new mongoose.Schema({
    role: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  });
  
  const chatSchema = new mongoose.Schema({
    threadId: { type: String, required: true, unique: true },
    messages: [messageSchema],
    createdAt: { type: Date, default: Date.now }
  });
  
  export const Chat = mongoose.model('Chat', chatSchema);