const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// In-memory storage for orders (use database in production)
let orders = [];

// Service prices
const servicePrices = {
  'resume': { name: 'Resume / CV Writing', price: 1500 }, // in paise (₹15)
  'presentation': { name: 'Presentations', price: 2500 }, // ₹25
  'content': { name: 'Content / Caption Writing', price: 500 }, // ₹5
  'cover-letter': { name: 'Cover Letter', price: 1000 } // ₹10
};

// Create Order API
app.post('/api/create-order', (req, res) => {
  const { service, email, name, requirements } = req.body;

  if (!service || !email || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const serviceInfo = servicePrices[service];
  if (!serviceInfo) {
    return res.status(400).json({ error: 'Invalid service' });
  }

  // Create order ID
  const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();

  // Store order
  const order = {
    orderId,
    service: serviceInfo.name,
    price: serviceInfo.price,
    email,
    name,
    requirements: requirements || '',
    status: 'pending',
    createdAt: new Date()
  };

  orders.push(order);

  // For demo purposes, simulate payment (in production, use Razorpay/Stripe)
  const razorpayOrder = {
    id: orderId,
    amount: serviceInfo.price,
    currency: 'INR',
    receipt: orderId
  };

  res.json({
    success: true,
    order: razorpayOrder,
    orderId
  });
});

// Payment Verification API
app.post('/api/verify-payment', async (req, res) => {
  const { orderId, paymentId, signature } = req.body;

  // Find order
  const order = orders.find(o => o.orderId === orderId);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // In production, verify Razorpay signature here
  // const crypto = require('crypto');
  // const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
  //   .update(orderId + "|" + paymentId)
  //   .digest('hex');

  // Update order status
  order.status = 'paid';
  order.paymentId = paymentId;
  order.paidAt = new Date();

  // Send confirmation email to customer
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: order.email,
      subject: 'Order Confirmed - Briefoo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Order Confirmed! 🎉</h2>
          <p>Hi ${order.name},</p>
          <p>Thank you for your order! We've received your payment.</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Service:</strong> ${order.service}</p>
            <p><strong>Amount:</strong> ₹${order.price / 100}</p>
          </div>
          <p>Our team will start working on your order and deliver it within 30 minutes!</p>
          <p>We'll send the completed work to your email once it's ready.</p>
          <p style="margin-top: 30px;">Best regards,<br>The Briefoo Team</p>
        </div>
      `
    });

    // Send notification to admin
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
      to: process.env.ADMIN_EMAIL || 'your-email@gmail.com',
      subject: `New Order Received - ${order.service}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2 style="color: #22c55e;">New Order Received! 🚀</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 10px;">
            <p><strong>Order ID:</strong> ${order.orderId}</p>
            <p><strong>Customer Name:</strong> ${order.name}</p>
            <p><strong>Email:</strong> ${order.email}</p>
            <p><strong>Service:</strong> ${order.service}</p>
            <p><strong>Amount:</strong> ₹${order.price / 100}</p>
            <p><strong>Requirements:</strong></p>
            <p>${order.requirements || 'No specific requirements provided'}</p>
          </div>
          <p style="margin-top: 20px;">Log in to your dashboard to view and process this order.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'Payment verified and emails sent' });
  } catch (error) {
    console.error('Email error:', error);
    res.json({ success: true, message: 'Payment verified (email sending failed)' });
  }
});

// Get Order Status API
app.get('/api/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders.find(o => o.orderId === orderId);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  
  res.json(order);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Get all orders (for admin)
app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Email configuration needed in .env file for emails to work');
});
