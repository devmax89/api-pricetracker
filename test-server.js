const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Test OK' });
});

const server = app.listen(3000, '0.0.0.0', () => {
  console.log('✅ Test server listening on port 3000');
});

server.on('error', (err) => {
  console.error('❌ Error:', err);
});
