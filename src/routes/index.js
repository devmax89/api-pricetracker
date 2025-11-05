const express = require('express');
const router = express.Router();

const productsRoutes = require('./products');
const statsRoutes = require('./stats');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PriceTracker API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount routes
router.use('/products', productsRoutes);
router.use('/stats', statsRoutes);

module.exports = router;
