const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// In-memory store (replace with MongoDB for production)
const subscribers = [];

// POST /api/notify/subscribe
router.post('/subscribe', async (req, res) => {
  const { email, query, location } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Invalid email' });
  }

  // Check if already subscribed
  const exists = subscribers.find(s => s.email === email && s.query === query);
  if (exists) {
    return res.json({ success: true, message: 'Already subscribed!' });
  }

  subscribers.push({ email, query, location, createdAt: new Date() });

  // Send confirmation email
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Events Near Me" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔔 You\'re subscribed to event alerts!',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#ff3cac">Events Near Me 📍</h2>
          <p>Hey! You're now subscribed to event alerts for:</p>
          <ul>
            ${query ? `<li><strong>Topic:</strong> ${query}</li>` : ''}
            ${location ? `<li><strong>Location:</strong> ${location}</li>` : ''}
          </ul>
          <p>We'll notify you the moment new matching events go live.</p>
          <p style="color:#888;font-size:12px">Events Near Me — Discover what's happening around you.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Email error:', e.message);
    // Still return success even if email fails
  }

  res.json({ success: true, message: 'Subscribed successfully!' });
});

// GET /api/notify/subscribers (admin only in production - add auth middleware)
router.get('/subscribers', (req, res) => {
  res.json({ success: true, count: subscribers.length, subscribers });
});

module.exports = router;
