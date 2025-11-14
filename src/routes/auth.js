const express = require('express');
const router = express.Router();

/**
 * NextAuth endpoints
 * Questi sono stub - NextAuth nel frontend gestisce l'autenticazione
 */

router.get('/session', (req, res) => {
  res.json({ user: null });
});

router.post('/signin', (req, res) => {
  res.json({ ok: true });
});

router.post('/signout', (req, res) => {
  res.json({ ok: true });
});

router.get('/error', (req, res) => {
  res.status(404).json({ error: 'Auth error' });
});

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: 'not-implemented' });
});

module.exports = router;