const express = require('express');
const router = express.Router();

const productsRoutes = require('./products');
const alertsRoutes = require('./alerts');
const pricesRoutes = require('./prices');

router.use('/products', productsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/', pricesRoutes);

module.exports = router;