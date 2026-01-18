require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const downloadRouter = require('./routes/download');
const flipRouter = require('./routes/flip');
const audioRouter = require('./routes/audio');
const facebookRouter = require('./routes/facebook');
const youtubeRouter = require('./routes/youtube');
const splitRouter = require('./routes/split');
const reupRouter = require('./routes/reup');
const batchRouter = require('./routes/batch');
const audioModRouter = require('./routes/audioMod');
const convertRouter = require('./routes/convert');
const captionRouter = require('./routes/caption');
const subtitleRouter = require('./routes/subtitle');
const schedulerRouter = require('./routes/scheduler');
const tiktokAuthRouter = require('./routes/tiktok-auth');
const tiktokFeedRouter = require('./routes/tiktok-feed');
const libraryRouter = require('./routes/library');
const trackingRouter = require('./routes/tracking');
const dashboardApiRouter = require('./routes/dashboard-api');
const affiliateRouter = require('./routes/affiliate');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for express-rate-limit behind reverse proxy (Railway, Heroku, etc.)
app.set('trust proxy', 1);

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

// Non-www to www redirect - www.tikdown.top is the canonical domain
// MUST be before all other routes
app.use((req, res, next) => {
  const host = req.get('host') || req.headers.host || '';
  const hostWithoutPort = host.split(':')[0];

  // Redirect non-www to www
  if (hostWithoutPort === 'tikdown.top') {
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
app.use('/api/split', splitRouter);
app.use('/api/reup', reupRouter);
app.use('/api/batch', batchRouter);
app.use('/api/audio-mod', audioModRouter);
app.use('/api/convert', convertRouter);
app.use('/api/caption', captionRouter);
app.use('/api/subtitle', subtitleRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/tiktok', tiktokAuthRouter);
app.use('/api/tiktok', tiktokFeedRouter); // Merges routes under /api/tiktok
app.use('/api/library', libraryRouter);
app.use('/r', trackingRouter); // Short link for redirect tracking
app.use('/api/dashboard', dashboardApiRouter); // APIs for Mod 5, 7, 8
app.use('/api/affiliate', affiliateRouter);
app.use('/api/dashboard', require('./routes/dashboard-api'));
app.use('/api', require('./routes/dashboard-api')); // For /api/settings convenience

// Stock Media Search API
const stockService = require('./services/stock-service');
app.get('/api/stock/search', async (req, res) => {
  try {
    const query = req.query.q || 'product';
    const videos = await stockService.searchVideos(query, 3);
    const images = await stockService.searchImages(query, 3);
    res.json({ success: true, data: [...videos, ...images] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// Auto Reup Safe Mode landing page
app.get('/auto-reup-safe-mode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auto-reup-safe-mode.html'));
});

// Batch Video Cutter landing page
app.get('/batch-video-cutter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'batch-video-cutter.html'));
});

// Safe Audio Modifier landing page
app.get('/safe-audio-modifier', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'safe-audio-modifier.html'));
});

// Video Format Converter landing page
app.get('/video-format-converter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'video-format-converter.html'));
});


// Caption & Hashtag Generator landing page
app.get('/caption-hashtag-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'caption-hashtag-generator.html'));
});

// Auto Subtitle Tool landing page
app.get('/auto-subtitle-video', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auto-subtitle-video.html'));
});

// Legal Policy Pages
app.get('/disclaimer-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'disclaimer-policy.html'));
});

app.get('/dmca-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dmca-policy.html'));
});

// Video Splitter SEO landing page
app.get('/cat-video-online', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cat-video-online.html'));
});

// MMO Tool Interface (New)
app.get('/tool', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tiktok-tool.html'));
});

// TikTok Scheduler Dashboard
app.get('/scheduler', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scheduler.html'));
});

// Affiliate Dashboard (New)
app.get('/affiliate-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'affiliate-dashboard.html'));
});

// Serve static frontend files AFTER specific routes
app.use(express.static(path.join(__dirname, 'public')));
// Serve Temp for Draft Images (DEV ONLY - Safe for local tool)
app.use('/temp', express.static(path.join(__dirname, 'temp')));

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
