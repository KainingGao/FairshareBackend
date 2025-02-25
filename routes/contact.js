//C:\Users\kygao\Documents\FairshareBackend\routes\contact.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Create email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Validate API key middleware for admin routes
const validateApiKey = (req, res, next) => {
  const apiKey = req.body.apiKey || req.query.apiKey || req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.BACKEND_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

// =========================================
// PUBLIC ROUTES (Used by frontend)
// =========================================

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Contact routes working' });
});

// Handle contact form submission
router.post('/submit', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    // Connect to MongoDB
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');

    // Save contact message to database
    const result = await contacts.insertOne({
      name,
      email,
      message,
      createdAt: new Date(),
      status: 'new', // Add status field for tracking
      replied: false // Track if this contact has been replied to
    });

    // Send confirmation email to client
    await transporter.sendMail({
      from: '"FairShare Tax & Bookkeeping" <admin@fairsharetaxbookkeepings.com>',
      to: email,
      subject: 'Thank you for contacting FairShare Tax & Bookkeeping',
      html: `
        <h2>Thank you for reaching out, ${name}!</h2>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p>For your reference, here's a copy of your message:</p>
        <blockquote>${message}</blockquote>
        <p>Best regards,<br>FairShare Tax & Bookkeeping Team</p>
      `
    });

    // Send notification to admin
    await transporter.sendMail({
      from: '"FairShare Contact Form" <admin@fairsharetaxbookkeepings.com>',
      to: 'admin@fairsharetaxbookkeepings.com',
      subject: 'New Contact Form Submission',
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <blockquote>${message}</blockquote>
      `
    });

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully'
    });
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing your request'
    });
  } finally {
    await client.close();
  }
});

// =========================================
// ADMIN ROUTES (Hidden path with API key validation)
// =========================================

// Get all contacts with pagination for admin
router.get('/admin/contacts', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filtering options
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.replied !== undefined) {
      filter.replied = req.query.replied === 'true';
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { message: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Find contacts with filtering and pagination
    const totalContacts = await contacts.countDocuments(filter);
    const contactList = await contacts.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    res.json({
      data: contactList,
      pagination: {
        total: totalContacts,
        page,
        limit,
        pages: Math.ceil(totalContacts / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get contact by ID for admin
router.get('/admin/contacts/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    const contact = await contacts.findOne({ _id: new ObjectId(req.params.id) });
    
    if (contact) {
      res.json(contact);
    } else {
      res.status(404).json({ message: 'Contact not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Update contact status for admin
router.put('/admin/contacts/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    // Prepare update data
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id; // Remove _id field if present
    delete updateData.apiKey; // Remove apiKey field
    
    const result = await contacts.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    // Get updated contact
    const updatedContact = await contacts.findOne({ _id: new ObjectId(req.params.id) });
    
    res.json({
      message: 'Contact updated successfully',
      contact: updatedContact
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Reply to contact (send email) for admin
router.post('/admin/contacts/:id/reply', validateApiKey, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }
    
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    // Get contact details
    const contact = await contacts.findOne({ _id: new ObjectId(req.params.id) });
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    // Send email reply
    await transporter.sendMail({
      from: '"FairShare Tax & Bookkeeping" <admin@fairsharetaxbookkeepings.com>',
      to: contact.email,
      subject: subject,
      html: `
        <p>Dear ${contact.name},</p>
        <div>${message}</div>
        <p><br>Best regards,<br>FairShare Tax & Bookkeeping Team</p>
      `
    });
    
    // Update contact as replied
    await contacts.updateOne(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          replied: true,
          status: 'replied',
          lastReplied: new Date()
        },
        $push: {
          replies: {
            subject,
            message,
            sentAt: new Date()
          }
        }
      }
    );
    
    res.json({ message: 'Reply sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Delete contact for admin
router.delete('/admin/contacts/:id', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    const result = await contacts.deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Contact not found' });
    }
    
    res.json({
      message: 'Contact deleted successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Delete multiple contacts for admin
router.post('/admin/contacts/delete-multiple', validateApiKey, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide valid contact IDs' });
    }
    
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    // Convert string ids to ObjectIds
    const objectIds = ids.map(id => new ObjectId(id));
    
    const result = await contacts.deleteMany({ _id: { $in: objectIds } });
    
    res.json({ 
      message: `${result.deletedCount} contacts deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

// Get contact statistics for admin dashboard
router.get('/admin/contacts/stats', validateApiKey, async (req, res) => {
  try {
    await client.connect();
    const database = client.db('fairshare');
    const contacts = database.collection('contacts');
    
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get first day of current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Calculate date 7 days ago
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    
    // Calculate date 30 days ago
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    
    // Execute all queries in parallel for better performance
    const [
      totalContacts,
      newContacts,
      repliedContacts,
      todayContacts,
      last7DaysContacts,
      thisMonthContacts,
      statusCounts
    ] = await Promise.all([
      contacts.countDocuments({}),
      contacts.countDocuments({ status: 'new' }),
      contacts.countDocuments({ replied: true }),
      contacts.countDocuments({ createdAt: { $gte: today } }),
      contacts.countDocuments({ createdAt: { $gte: last7Days } }),
      contacts.countDocuments({ createdAt: { $gte: firstDayOfMonth } }),
      contacts.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray()
    ]);
    
    // Format status counts into an object
    const statusCountsObj = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});
    
    res.json({
      total: totalContacts,
      new: newContacts,
      replied: repliedContacts,
      today: todayContacts,
      last7Days: last7DaysContacts,
      thisMonth: thisMonthContacts,
      byStatus: statusCountsObj
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    await client.close();
  }
});

module.exports = router;