#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_PATH = path.join(__dirname, '..', 'dist');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Serve static files
app.use(express.static(DIST_PATH, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  index: 'index.html'
}));

// PWA Installation Routes - handle query parameters
app.get('/', (req, res, next) => {
  // Check for install parameters and handle accordingly
  if (req.query.install === 'android' || req.query.install === 'ios') {
    // Set headers for PWA installation
    res.set({
      'X-PWA-Install': req.query.install,
      'X-PWA-URL': 'https://beta-controller.knirv.com'
    });
  }
  next();
});

// API endpoint to check PWA installation status
app.get('/api/pwa/status', (req, res) => {
  res.json({
    pwa_url: "https://beta-controller.knirv.com",
    pwa_install_android: "https://beta-controller.knirv.com/?install=android",
    pwa_install_ios: "https://beta-controller.knirv.com/?install=ios",
    manifest_url: "/manifest.json",
    service_worker_url: "/sw.js",
    status: "available"
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    pwa_enabled: true,
    endpoints: {
      pwa_url: "https://beta-controller.knirv.com",
      pwa_install_android: "https://beta-controller.knirv.com/?install=android",
      pwa_install_ios: "https://beta-controller.knirv.com/?install=ios"
    }
  });
});

// Handle SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_PATH, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KNIRV Controller static server running on port ${PORT}`);
  console.log(`Serving files from: ${DIST_PATH}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});