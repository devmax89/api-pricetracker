const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const cache = require('../middleware/cache');

// GET /api/stats - Get overall stats
router.get('/', cache(300), statsController.getOverallStats);

// GET /api/stats/deals - Get best deals
router.get('/deals', cache(60), statsController.getBestDeals);

// GET /api/stats/trends/:id - Get price trends for product
router.get('/trends/:id', cache(300), statsController.getPriceTrends);

module.exports = router;
