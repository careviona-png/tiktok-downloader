require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const downloadRouter = require('./routes/download');
const flipRouter = require('./routes/flip');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware cơ bản
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ SERVE STATIC FILES – PHẢI ĐẶT TRƯỚC
app.use(express.static(path.join(__dirname, 'public')));

// Logging (để sau static)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api', downloadRouter);
app.use('/api', flipRouter);

// Homepage (optional – static đã cover rồi)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler (sau cùng)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
