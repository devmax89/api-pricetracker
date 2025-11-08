const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || '192.168.1.227',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pricetracker',
  user: process.env.DB_USER || 'pricetracker',
  password: process.env.DB_PASSWORD || 'fnNlh5xkATY0MDsVIEt1U7FS/bdsIbsMVSH2LRTvYFc=',
});

/**
 * GET /api/categories
 * Lista tutte le categorie con conteggio prodotti
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.slug,
        c.name,
        c.name_plural,
        c.icon,
        c.is_featured,
        c.sort_order,
        COUNT(p.id)::int as product_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.slug AND p.is_active = true
      GROUP BY c.slug, c.name, c.name_plural, c.icon, c.is_featured, c.sort_order
      ORDER BY c.sort_order ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/categories/:slug
 * Dettaglio singola categoria
 */
router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  
  try {
    const query = `
      SELECT 
        c.slug,
        c.name,
        c.name_plural,
        c.icon,
        c.is_featured,
        c.sort_order,
        COUNT(p.id)::int as product_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.slug AND p.is_active = true
      WHERE c.slug = $1
      GROUP BY c.slug, c.name, c.name_plural, c.icon, c.is_featured, c.sort_order
    `;
    
    const result = await pool.query(query, [slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Category not found' 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

module.exports = router;