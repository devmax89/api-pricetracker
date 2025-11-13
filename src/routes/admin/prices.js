const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * GET /api/admin/products/:productId/prices
 * Lista prezzi per un prodotto (new + used)
 */
router.get('/products/:productId/prices', async (req, res) => {
  try {
    const { productId } = req.params;

    // Prezzi NEW (price_history)
    const newPrices = await db.query(`
      SELECT 
        id,
        retailer,
        price,
        url,
        scraped_at
      FROM price_history
      WHERE product_id = $1
      ORDER BY scraped_at DESC
      LIMIT 50
    `, [productId]);

    // Prezzi USED (used_listings) - ✅ CORRETTO: external_url invece di url
    const usedPrices = await db.query(`
      SELECT 
        id,
        title,
        price,
        external_url,
        location,
        condition,
        is_active,
        scraped_at
      FROM used_listings
      WHERE product_id = $1
      ORDER BY scraped_at DESC
      LIMIT 50
    `, [productId]);

    res.json({
      success: true,
      data: {
        new_prices: newPrices.rows,
        used_prices: usedPrices.rows,
      }
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * PUT /api/admin/prices/new/:id
 * Modifica prezzo NEW
 */
router.put('/prices/new/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { price, retailer, url } = req.body;

    const result = await db.query(`
      UPDATE price_history
      SET 
        price = COALESCE($1, price),
        retailer = COALESCE($2, retailer),
        url = COALESCE($3, url)
      WHERE id = $4
      RETURNING *
    `, [price, retailer, url, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Price not found'
      });
    }

    res.json({
      success: true,
      message: 'Price updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * PUT /api/admin/prices/used/:id
 * Modifica prezzo USED - ✅ CORRETTO: external_url
 */
router.put('/prices/used/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { price, title, external_url, is_active } = req.body;

    const result = await db.query(`
      UPDATE used_listings
      SET 
        price = COALESCE($1, price),
        title = COALESCE($2, title),
        external_url = COALESCE($3, external_url),
        is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING *
    `, [price, title, external_url, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Used listing not found'
      });
    }

    res.json({
      success: true,
      message: 'Used listing updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating used listing:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * DELETE /api/admin/prices/new/:id
 */
router.delete('/prices/new/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM price_history
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Price not found'
      });
    }

    res.json({
      success: true,
      message: 'Price deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting price:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * DELETE /api/admin/prices/used/:id
 */
router.delete('/prices/used/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM used_listings
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Used listing not found'
      });
    }

    res.json({
      success: true,
      message: 'Used listing deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting used listing:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;