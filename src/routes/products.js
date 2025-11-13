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
 * GET /api/products
 * Lista tutti i prodotti con prezzi aggregati
 */
router.get('/', async (req, res) => {
  const category = req.query.category;
  const limit = parseInt(req.query.limit) || 50;
  
  try {
    let query = `
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
          AVG(price)::DECIMAL(10,2) as avg_price,
          MAX(price) as max_price,
          COUNT(DISTINCT retailer) as retailers_count,
          MAX(scraped_at) as last_updated
        FROM latest_prices
        GROUP BY product_id
      ),
      used_prices AS (
        SELECT 
          product_id,
          MIN(price) as min_price,
          AVG(price)::DECIMAL(10,2) as avg_price,
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
        p.category as category_slug,
        p.description,
        p.image_url,
        p.is_active,
        
        np.min_price as new_min_price,
        np.avg_price as new_avg_price,
        np.max_price as new_max_price,
        np.retailers_count,
        np.last_updated,
        
        up.min_price as used_min_price,
        up.avg_price as used_avg_price,
        up.count as used_count,
        
        CASE 
          WHEN np.min_price IS NOT NULL AND up.min_price IS NOT NULL
          THEN ROUND(((np.min_price - up.min_price) / np.min_price * 100)::numeric, 1)
          ELSE NULL
        END as discount_percentage
        
      FROM products p
      LEFT JOIN new_prices np ON p.id = np.product_id
      LEFT JOIN used_prices up ON p.id = up.product_id
      WHERE p.is_active = true
    `;
    
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    
    query += ` ORDER BY p.name ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/products/:id
 * Dettaglio singolo prodotto
 */
router.get('/:id', async (req, res) => {
  const productId = parseInt(req.params.id);
  
  if (isNaN(productId)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid product ID' 
    });
  }
  
  try {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.model,
        p.brand,
        p.category,
        p.category as category_slug,
        p.description,
        p.image_url,
        p.amazon_url,
        p.subito_url,
        p.created_at,
        p.updated_at
      FROM products p
      WHERE p.id = $1
    `;
    
    const result = await pool.query(query, [productId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/products/:id/prices
 * Prezzi nuovo e usato per un prodotto con stats
 * 🆕 UPDATED: Include MediaWorld Ricondizionati fields
 */
router.get('/:id/prices', async (req, res) => {
  const productId = parseInt(req.params.id);
  
  if (isNaN(productId)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid product ID' 
    });
  }
  
  try {
    // 1. Product info
    const productQuery = `
      SELECT 
        p.id, 
        p.name, 
        p.model,
        p.brand,
        p.category,
        p.description,
        p.image_url
      FROM products p
      WHERE p.id = $1
    `;
    
    const productResult = await pool.query(productQuery, [productId]);
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }
    
    const product = productResult.rows[0];
    
    // 2. New prices (latest from each retailer)
    const newPricesQuery = `
      SELECT DISTINCT ON (retailer) 
        retailer,
        price,
        availability,
        scraped_at,
        url,
        condition
      FROM price_history
      WHERE product_id = $1
      ORDER BY retailer, scraped_at DESC
    `;
    
    const newPricesResult = await pool.query(newPricesQuery, [productId]);
    const new_prices = newPricesResult.rows;
    
    // 3. Used listings (active only, ordered by price)
    // 🆕 UPDATED: Added source, grading, discount_percentage, original_price, new_price
    const usedQuery = `
      SELECT 
        id,
        title,
        price,
        external_url as url,
        location,
        city,
        province,
        condition,
        seller_type,
        source,
        posted_at,
        scraped_at,
        last_checked_at,
        grading,
        discount_percentage,
        original_price,
        new_price
      FROM used_listings
      WHERE product_id = $1 
        AND is_active = true
      ORDER BY price ASC
      LIMIT 50
    `;
    
    const usedResult = await pool.query(usedQuery, [productId]);
    const used_listings = usedResult.rows;
    
    // 4. Calculate statistics
    const stats = calculateStats(new_prices, used_listings);
    
    // 5. Return complete response
    res.json({
      success: true,
      product,
      new_prices,
      used_listings,
      stats
    });
    
  } catch (error) {
    console.error('Error fetching product prices:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/products/:id/history
 * Storico prezzi per grafico
 */
router.get('/:id/history', async (req, res) => {
  const productId = parseInt(req.params.id);
  const days = parseInt(req.query.days) || 30;
  const retailer = req.query.retailer;
  
  if (isNaN(productId)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid product ID' 
    });
  }
  
  try {
    let query = `
      SELECT 
        retailer,
        price,
        availability,
        scraped_at
      FROM price_history
      WHERE product_id = $1
        AND scraped_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [productId];
    
    if (retailer) {
      query += ` AND retailer = $2`;
      params.push(retailer);
    }
    
    query += ` ORDER BY scraped_at ASC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      product_id: productId,
      days,
      retailer: retailer || 'all',
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/products/:id/used/nearby
 * Annunci usato nelle vicinanze
 * 🆕 UPDATED: Added source field
 */
router.get('/:id/used/nearby', async (req, res) => {
  const productId = parseInt(req.params.id);
  const city = req.query.city;
  const limit = parseInt(req.query.limit) || 20;
  
  if (isNaN(productId)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid product ID' 
    });
  }
  
  try {
    let query = `
      SELECT 
        id, 
        title, 
        price, 
        external_url as url, 
        location, 
        city, 
        province,
        condition, 
        seller_type,
        source,
        posted_at, 
        scraped_at,
        grading,
        discount_percentage
      FROM used_listings
      WHERE product_id = $1 
        AND is_active = true
    `;
    
    const params = [productId];
    
    if (city) {
      params.push(`%${city}%`);
      query += ` AND (city ILIKE $${params.length} OR province ILIKE $${params.length})`;
    }
    
    query += ` ORDER BY price ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      product_id: productId,
      city: city || 'all',
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching nearby listings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

/**
 * Helper function: Calculate price statistics
 */
function calculateStats(newPrices, usedListings) {
  const stats = {
    new_min_price: null,
    new_max_price: null,
    new_avg_price: null,
    new_count: newPrices.length,
    used_min_price: null,
    used_max_price: null,
    used_avg_price: null,
    used_count: usedListings.length,
    savings_potential: null,
    savings_percentage: null
  };
  
  if (newPrices.length > 0) {
    const prices = newPrices.map(p => parseFloat(p.price));
    stats.new_min_price = Math.min(...prices);
    stats.new_max_price = Math.max(...prices);
    stats.new_avg_price = parseFloat(
      (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
    );
  }
  
  if (usedListings.length > 0) {
    const prices = usedListings.map(l => parseFloat(l.price));
    stats.used_min_price = Math.min(...prices);
    stats.used_max_price = Math.max(...prices);
    stats.used_avg_price = parseFloat(
      (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
    );
  }
  
  if (stats.new_min_price && stats.used_min_price) {
    stats.savings_potential = parseFloat(
      (stats.new_min_price - stats.used_min_price).toFixed(2)
    );
    stats.savings_percentage = parseFloat(
      ((stats.savings_potential / stats.new_min_price) * 100).toFixed(1)
    );
  }
  
  return stats;
}

module.exports = router;