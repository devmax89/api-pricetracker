const express = require('express');
const router = express.Router();

const productsRoutes = require('./products');
const alertsRoutes = require('./alerts');
const pricesRoutes = require('./prices');

router.use('/products', productsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/', pricesRoutes);

// 🆕 Recent Activity
router.get('/recent-activity', async (req, res) => {
  try {
    const db = require('../../config/database');
    
    // Ultimi 10 scraping
    const recentScrapings = await db.query(`
      SELECT 
        'scraping' as type,
        'Nuovo prezzo trovato: ' || p.name || ' su ' || ph.retailer || ' a €' || ph.price as message,
        ph.scraped_at as created_at
      FROM price_history ph
      JOIN products p ON ph.product_id = p.id
      ORDER BY ph.scraped_at DESC
      LIMIT 5
    `);

    // Ultimi 5 alert creati
    const recentAlerts = await db.query(`
      SELECT 
        'alert' as type,
        'Nuovo alert creato per ' || p.name || ' (target: €' || pa.target_price || ')' as message,
        pa.created_at
      FROM price_alerts pa
      JOIN products p ON pa.product_id = p.id
      ORDER BY pa.created_at DESC
      LIMIT 5
    `);

    // Combina e ordina
    const activities = [
      ...recentScrapings.rows,
      ...recentAlerts.rows
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;