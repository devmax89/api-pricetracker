const db = require('../config/database');

// Get all products
exports.getAllProducts = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        name, 
        model, 
        brand,
        is_active,
        created_at
      FROM products
      WHERE is_active = true
      ORDER BY name
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID
exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT *
      FROM products
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Product not found' },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get current prices for a product
exports.getProductPrices = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT DISTINCT ON (retailer)
        retailer,
        price,
        scraped_at
      FROM price_history
      WHERE product_id = $1
      ORDER BY retailer, scraped_at DESC
    `, [id]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

// Get price history for a product
exports.getProductPriceHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { retailer, days = 7 } = req.query;

    let query = `
      SELECT 
        retailer,
        price,
        scraped_at
      FROM price_history
      WHERE product_id = $1
        AND scraped_at > NOW() - INTERVAL '${parseInt(days)} days'
    `;

    const params = [id];

    if (retailer) {
      query += ` AND retailer = $2`;
      params.push(retailer);
    }

    query += ` ORDER BY scraped_at DESC LIMIT 1000`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};
