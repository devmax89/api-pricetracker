const redisClient = require('../config/redis');

const cache = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        console.log(`🎯 Cache HIT: ${key}`);
        return res.json(JSON.parse(cachedData));
      }

      console.log(`❌ Cache MISS: ${key}`);
      
      // Store original res.json
      const originalJson = res.json.bind(res);
      
      // Override res.json
      res.json = (data) => {
        // Cache the response
        redisClient.setEx(key, duration, JSON.stringify(data))
          .catch(err => console.error('Cache set error:', err));
        
        // Send response
        return originalJson(data);
      };

      next();
    } catch (err) {
      console.error('Cache middleware error:', err);
      next();
    }
  };
};

module.exports = cache;
