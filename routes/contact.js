const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Create email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // admin@fairsharetaxbookkeepings.com
    pass: process.env.EMAIL_PASS
  }
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
      createdAt: new Date()
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

module.exports = router;