require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const downloadRouter = require('./routes/download');
const flipRouter = require('./routes/flip');
const facebookRouter = require('./routes/facebook');

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable temporarily if it breaks external assets, but recommended to keep on
  crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api', limiter);

app.use((req, res, next) => {
  const host = req.get('host');
  if (host === 'tikdown.top') {
    return res.redirect(301, `https://www.tikdown.top${req.originalUrl}`);
  }
  next();
});

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes - MUST come before static files
app.use('/api/download', downloadRouter);
app.use('/api/flip', flipRouter);
app.use('/api/audio', audioRouter);
app.use('/api/facebook', facebookRouter);
app.use('/api/youtube', youtubeRouter);


// TikTok to MP3 SEO landing page
app.get('/convert-tiktok-to-mp3', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'convert-tiktok-to-mp3.html'));
});

// Reverse Video SEO landing page
app.get('/dao-nguoc-video-online', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dao-nguoc-video-online.html'));
});

// YouTube Shorts SEO landing page
app.get('/tai-video-youtube-shorts-online', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tai-video-youtube-shorts.html'));
});

// Serve static frontend files AFTER specific routes
app.use(express.static(path.join(__dirname, 'public')));

// Homepage route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
  console.log(`✅ API available at http://localhost:${PORT}/api/download`);
});
