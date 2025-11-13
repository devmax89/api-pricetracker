const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * GET /api/admin/alerts
 * Lista tutti gli alert per admin
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        pa.id,
        pa.product_id,
        pa.email,
        pa.target_price,
        pa.is_active,
        pa.notified,
        pa.created_at,
        pa.triggered_at,
        p.name as product_name,
        p.brand as product_brand
      FROM price_alerts pa
      JOIN products p ON pa.product_id = p.id
      ORDER BY pa.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin alerts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * DELETE /api/admin/alerts/:id
 * Elimina alert
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM price_alerts
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/admin/alerts/stats
 * Statistiche alert per dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE is_active = true AND notified = false) as active_count,
        COUNT(*) FILTER (WHERE notified = true) as notified_count,
        COUNT(DISTINCT email) as unique_users,
        AVG(target_price) as avg_target_price
      FROM price_alerts
    `);

    res.json({
      success: true,
      ...stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;