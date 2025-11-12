const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');

/**
 * POST /api/alerts
 * Crea un nuovo price alert
 * 
 * Body:
 * {
 *   "product_id": 1,
 *   "email": "user@example.com",
 *   "target_price": 899.99
 * }
 */
router.post('/', alertsController.createAlert);

/**
 * GET /api/alerts/stats
 * Statistiche sugli alert (admin/debug)
 */
router.get('/stats', alertsController.getAlertStats);

/**
 * GET /api/alerts/check
 * Controlla quali alert devono essere triggerati
 * (Endpoint utilizzato dallo scheduler Python)
 */
router.get('/check', alertsController.checkAlerts);

/**
 * POST /api/alerts/:id/mark-notified
 * Marca un alert come notificato dopo l'invio dell'email
 */
router.post('/:id/mark-notified', alertsController.markAsNotified);

module.exports = router;