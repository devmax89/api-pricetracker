const express = require('express');
const router = express.Router();

const productsRoutes = require('./products');
const statsRoutes = require('./stats');
const categoriesRoutes = require('./categories');
const alertsRoutes = require('./alerts');
const adminRoutes = require('./admin');

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
router.use('/categories', categoriesRoutes);
router.use('/alerts', alertsRoutes);
router.use('/admin', adminRoutes);

module.exports = router;