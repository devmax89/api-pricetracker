const express = require('express');
const router = express.Router();

const productsRoutes = require('./products');
const alertsRoutes = require('./alerts');

// Mount admin routes
router.use('/products', productsRoutes);
router.use('/alerts', alertsRoutes);

module.exports = router;