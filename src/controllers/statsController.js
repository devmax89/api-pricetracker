const db = require('../config/database');

// Get overall stats
exports.getOverallStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT product_id) as total_products,
        COUNT(DISTINCT retailer) as total_retailers,
        COUNT(*) as total_price_records,
        MIN(scraped_at) as first_record,
        MAX(scraped_at) as last_record
      FROM price_history
    `);

    res.json({
      success: true,
      data: stats.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// Get best deals (lowest prices)
exports.getBestDeals = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const result = await db.query(`
      SELECT DISTINCT ON (p.id, ph.retailer)
        p.id,
        p.name,
        p.model,
        ph.retailer,
        ph.price,
        ph.scraped_at
      FROM products p
      JOIN price_history ph ON p.id = ph.product_id
      WHERE p.is_active = true
        AND ph.scraped_at > NOW() - INTERVAL '24 hours'
      ORDER BY p.id, ph.retailer, ph.scraped_at DESC
    `);

    // Get lowest price per product
    const deals = result.rows
      .reduce((acc, curr) => {
        const existing = acc.find(item => item.id === curr.id);
        if (!existing || curr.price < existing.price) {
          return [...acc.filter(item => item.id !== curr.id), curr];
        }
        return acc;
      }, [])
      .sort((a, b) => a.price - b.price)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      count: deals.length,
      data: deals,
    });
  } catch (error) {
    next(error);
  }
};

// Get price trends
exports.getPriceTrends = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.query;

    const result = await db.query(`
      SELECT 
        DATE_TRUNC('day', scraped_at) as date,
        retailer,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        COUNT(*) as samples
      FROM price_history
      WHERE product_id = $1
        AND scraped_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE_TRUNC('day', scraped_at), retailer
      ORDER BY date DESC, retailer
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
