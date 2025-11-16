const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * GET /api/admin/products
 * Lista prodotti con più dettagli per admin
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      WITH 
      latest_prices AS (
        SELECT DISTINCT ON (product_id, retailer)
          product_id, retailer, price, scraped_at
        FROM price_history
        ORDER BY product_id, retailer, scraped_at DESC
      ),
      new_prices AS (
        SELECT 
          product_id,
          MIN(price) as min_price,
          COUNT(DISTINCT retailer) as retailers_count,
          MAX(scraped_at) as last_updated
        FROM latest_prices
        GROUP BY product_id
      ),
      used_prices AS (
        SELECT 
          product_id,
          MIN(price) as min_price,
          COUNT(*) as count
        FROM used_listings
        WHERE is_active = true
        GROUP BY product_id
      )
      
      SELECT 
        p.id,
        p.name,
        p.model,
        p.brand,
        p.category,
        p.description,
        p.image_url,
        p.amazon_url,
        p.subito_url,
        p.is_active,
        p.created_at,
        p.updated_at,
        
        np.min_price as new_min_price,
        np.retailers_count,
        np.last_updated,
        
        up.min_price as used_min_price,
        up.count as used_count
        
      FROM products p
      LEFT JOIN new_prices np ON p.id = np.product_id
      LEFT JOIN used_prices up ON p.id = up.product_id
      ORDER BY p.id DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/admin/products
 * Crea nuovo prodotto
 */
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      brand, 
      model, 
      category, 
      description,
      image_url,
      amazon_url,
      mediaworld_url,
      mediaworld_ricondizionati_url,
      ldlc_url,
      akinformatica_url,
      nexths_url,
      subito_url
    } = req.body;

    // Validazione
    if (!name || !brand || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, brand, category'
      });
    }

    // Genera slug automaticamente
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Rimuovi caratteri speciali
      .replace(/\s+/g, '-')          // Spazi → trattini
      .replace(/-+/g, '-')           // Multipli trattini → singolo
      .trim();

    const result = await db.query(`
      INSERT INTO products (
        name, brand, model, category, description, image_url,
        amazon_url, mediaworld_url, mediaworld_ricondizionati_url,
        ldlc_url, akinformatica_url, nexths_url, subito_url,
        slug, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
      RETURNING *
    `, [
      name, brand, model, category, description, image_url,
      amazon_url, mediaworld_url, mediaworld_ricondizionati_url,
      ldlc_url, akinformatica_url, nexths_url, subito_url,
      slug
    ]);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * PUT /api/admin/products/:id
 * Modifica prodotto esistente
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      brand, 
      model, 
      category, 
      description, 
      amazon_url, 
      subito_url, 
      image_url,
      is_active
    } = req.body;

    // Verifica che il prodotto esista
    const checkResult = await db.query('SELECT id FROM products WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const result = await db.query(`
      UPDATE products 
      SET 
        name = COALESCE($1, name),
        brand = COALESCE($2, brand),
        model = COALESCE($3, model),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        amazon_url = COALESCE($6, amazon_url),
        subito_url = COALESCE($7, subito_url),
        image_url = COALESCE($8, image_url),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [name, brand, model, category, description, amazon_url, subito_url, image_url, is_active, id]);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * PATCH /api/admin/products/:id/toggle
 * Toggle is_active status
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE products 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product status toggled successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error toggling product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Elimina prodotto (soft delete - marca come disattivo)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete - marca come disattivo invece di eliminare
    const result = await db.query(`
      UPDATE products 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;