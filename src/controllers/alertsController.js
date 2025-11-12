const db = require('../config/database');

/**
 * POST /api/alerts
 * Crea un nuovo price alert
 */
exports.createAlert = async (req, res, next) => {
  try {
    const { product_id, email, target_price } = req.body;

    // Validazione input
    if (!product_id || !email || !target_price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: product_id, email, target_price',
      });
    }

    // Validazione email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validazione target_price > 0
    if (parseFloat(target_price) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Target price must be greater than 0',
      });
    }

    // Verifica che il prodotto esista
    const productCheck = await db.query(
      'SELECT id, name FROM products WHERE id = $1',
      [product_id]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Ottieni prezzo minimo corrente del prodotto
    const currentPriceQuery = await db.query(`
      SELECT MIN(price) as current_min_price
      FROM (
        SELECT DISTINCT ON (retailer) price
        FROM price_history
        WHERE product_id = $1
        ORDER BY retailer, scraped_at DESC
      ) as latest_prices
    `, [product_id]);

    const currentMinPrice = currentPriceQuery.rows[0]?.current_min_price;

    // Validazione: target_price deve essere < prezzo corrente
    if (currentMinPrice && parseFloat(target_price) >= parseFloat(currentMinPrice)) {
      return res.status(400).json({
        success: false,
        error: `Target price must be lower than current minimum price (€${currentMinPrice})`,
        current_min_price: parseFloat(currentMinPrice),
      });
    }

    // Inserisci l'alert nel database
    const result = await db.query(`
      INSERT INTO price_alerts (product_id, email, target_price)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [product_id, email, target_price]);

    const alert = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Price alert created successfully',
      data: {
        id: alert.id,
        product_id: alert.product_id,
        product_name: productCheck.rows[0].name,
        email: alert.email,
        target_price: parseFloat(alert.target_price),
        current_min_price: currentMinPrice ? parseFloat(currentMinPrice) : null,
        created_at: alert.created_at,
        is_active: alert.is_active,
      },
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alerts/stats
 * Statistiche sugli alert (per admin/debug)
 */
exports.getAlertStats = async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE is_active = true) as active_alerts,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_alerts,
        COUNT(*) FILTER (WHERE notified = true) as notified_alerts,
        COUNT(DISTINCT product_id) as products_with_alerts,
        COUNT(DISTINCT email) as unique_users
      FROM price_alerts
    `);

    res.json({
      success: true,
      data: stats.rows[0],
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alerts/check
 * Endpoint per testare il sistema di check degli alert
 * (Sarà chiamato dallo script Python scheduler)
 */
exports.checkAlerts = async (req, res, next) => {
  try {
    // Query per trovare tutti gli alert attivi che devono essere triggerati
    const alertsToTrigger = await db.query(`
      WITH current_prices AS (
        SELECT DISTINCT ON (product_id)
          product_id,
          MIN(price) as current_min_price
        FROM (
          SELECT DISTINCT ON (product_id, retailer)
            product_id,
            retailer,
            price,
            scraped_at
          FROM price_history
          ORDER BY product_id, retailer, scraped_at DESC
        ) as latest
        GROUP BY product_id
      )
      SELECT 
        pa.id,
        pa.product_id,
        pa.email,
        pa.target_price,
        p.name as product_name,
        p.brand,
        p.model,
        p.image_url,
        cp.current_min_price,
        pa.created_at
      FROM price_alerts pa
      JOIN products p ON pa.product_id = p.id
      JOIN current_prices cp ON pa.product_id = cp.product_id
      WHERE pa.is_active = true
        AND pa.notified = false
        AND cp.current_min_price <= pa.target_price
      ORDER BY pa.created_at ASC
    `);

    const alerts = alertsToTrigger.rows;

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
      message: alerts.length > 0 
        ? `Found ${alerts.length} alert(s) ready to be triggered`
        : 'No alerts to trigger at this time',
    });

  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alerts/:id/mark-notified
 * Marca un alert come notificato (chiamato dopo invio email)
 */
exports.markAsNotified = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE price_alerts
      SET 
        notified = true,
        is_active = false,
        triggered_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      message: 'Alert marked as notified',
      data: result.rows[0],
    });

  } catch (error) {
    next(error);
  }
};