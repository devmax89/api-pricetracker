const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  password: process.env.REDIS_PASSWORD,
});

client.on('connect', () => {
  console.log('✅ Connected to Redis');
});

client.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

// Connect on startup
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }
})();

module.exports = client;
