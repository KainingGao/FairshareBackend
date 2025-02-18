const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    category: { type: String, required: true }
  });

  export const Blog = mongoose.model('Blog', blogSchema);