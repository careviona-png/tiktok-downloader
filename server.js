require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const downloadRouter = require('./routes/download');
const flipRouter = require('./routes/flip');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   TRUST PROXY (RAILWAY)
========================= */
app.set('trust proxy', true);

/* =========================
   BASIC MIDDLEWARES
========================= */
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   REDIRECT non-www → www
   (HTTP non-www sẽ redirect được)
========================= */
app.use((req, res, next) => {
  const host = req.headers.host;

  if (host === 'tikdown.top') {
    return res.redirect(
      301,
      'https://www.tikdown.top' + req.originalUrl
    );
  }

  next();
});

/* =========================
   SERVE STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   LOGGING
========================= */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* =========================
   API ROUTES
========================= */
app.use('/api', downloadRouter);
app.use('/api', flipRouter);

/* =========================
   HOMEPAGE (OPTIONAL)
========================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   ERROR HANDLER
========================= */
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
