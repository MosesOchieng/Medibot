const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server refused connection');
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis ready for commands');
    });

    redisClient.on('end', () => {
      logger.info('Redis connection ended');
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    logger.warn('⚠️  Running without Redis. Session management will be limited.');
    redisClient = null;
    return null;
  }
}

async function getRedisClient() {
  if (!redisClient) {
    logger.warn('Redis not initialized. Returning null.');
    return null;
  }
  return redisClient;
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

// Utility functions for common Redis operations
async function setWithExpiry(key, value, ttlSeconds = 3600) {
  try {
    const client = await getRedisClient();
    if (!client) {
      logger.warn('Redis not available. Skipping set operation.');
      return false;
    }
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await client.setEx(key, ttlSeconds, serializedValue);
    return true;
  } catch (error) {
    logger.error('Redis set error:', error);
    return false;
  }
}

async function get(key) {
  try {
    const client = await getRedisClient();
    if (!client) {
      logger.warn('Redis not available. Skipping get operation.');
      return null;
    }
    const value = await client.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
}

async function del(key) {
  try {
    const client = await getRedisClient();
    if (!client) {
      logger.warn('Redis not available. Skipping del operation.');
      return false;
    }
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Redis del error:', error);
    return false;
  }
}

async function exists(key) {
  try {
    const client = await getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logger.error('Redis exists error:', error);
    return false;
  }
}

async function expire(key, seconds) {
  try {
    const client = await getRedisClient();
    await client.expire(key, seconds);
    return true;
  } catch (error) {
    logger.error('Redis expire error:', error);
    return false;
  }
}

async function ttl(key) {
  try {
    const client = await getRedisClient();
    return await client.ttl(key);
  } catch (error) {
    logger.error('Redis ttl error:', error);
    return -1;
  }
}

async function keys(pattern) {
  try {
    const client = await getRedisClient();
    return await client.keys(pattern);
  } catch (error) {
    logger.error('Redis keys error:', error);
    return [];
  }
}

async function hset(key, field, value) {
  try {
    const client = await getRedisClient();
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await client.hSet(key, field, serializedValue);
    return true;
  } catch (error) {
    logger.error('Redis hset error:', error);
    return false;
  }
}

async function hget(key, field) {
  try {
    const client = await getRedisClient();
    const value = await client.hGet(key, field);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  } catch (error) {
    logger.error('Redis hget error:', error);
    return null;
  }
}

async function hgetall(key) {
  try {
    const client = await getRedisClient();
    const hash = await client.hGetAll(key);
    const result = {};
    
    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    }
    
    return result;
  } catch (error) {
    logger.error('Redis hgetall error:', error);
    return {};
  }
}

async function hdel(key, field) {
  try {
    const client = await getRedisClient();
    await client.hDel(key, field);
    return true;
  } catch (error) {
    logger.error('Redis hdel error:', error);
    return false;
  }
}

async function lpush(key, value) {
  try {
    const client = await getRedisClient();
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await client.lPush(key, serializedValue);
    return true;
  } catch (error) {
    logger.error('Redis lpush error:', error);
    return false;
  }
}

async function rpop(key) {
  try {
    const client = await getRedisClient();
    const value = await client.rPop(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  } catch (error) {
    logger.error('Redis rpop error:', error);
    return null;
  }
}

async function lrange(key, start, stop) {
  try {
    const client = await getRedisClient();
    const values = await client.lRange(key, start, stop);
    return values.map(value => {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    });
  } catch (error) {
    logger.error('Redis lrange error:', error);
    return [];
  }
}

async function llen(key) {
  try {
    const client = await getRedisClient();
    return await client.lLen(key);
  } catch (error) {
    logger.error('Redis llen error:', error);
    return 0;
  }
}

async function sadd(key, member) {
  try {
    const client = await getRedisClient();
    await client.sAdd(key, member);
    return true;
  } catch (error) {
    logger.error('Redis sadd error:', error);
    return false;
  }
}

async function srem(key, member) {
  try {
    const client = await getRedisClient();
    await client.sRem(key, member);
    return true;
  } catch (error) {
    logger.error('Redis srem error:', error);
    return false;
  }
}

async function smembers(key) {
  try {
    const client = await getRedisClient();
    return await client.sMembers(key);
  } catch (error) {
    logger.error('Redis smembers error:', error);
    return [];
  }
}

async function sismember(key, member) {
  try {
    const client = await getRedisClient();
    return await client.sIsMember(key, member);
  } catch (error) {
    logger.error('Redis sismember error:', error);
    return false;
  }
}

async function incr(key) {
  try {
    const client = await getRedisClient();
    return await client.incr(key);
  } catch (error) {
    logger.error('Redis incr error:', error);
    return 0;
  }
}

async function decr(key) {
  try {
    const client = await getRedisClient();
    return await client.decr(key);
  } catch (error) {
    logger.error('Redis decr error:', error);
    return 0;
  }
}

async function flushdb() {
  try {
    const client = await getRedisClient();
    await client.flushDb();
    logger.info('Redis database flushed');
    return true;
  } catch (error) {
    logger.error('Redis flushdb error:', error);
    return false;
  }
}

async function info() {
  try {
    const client = await getRedisClient();
    return await client.info();
  } catch (error) {
    logger.error('Redis info error:', error);
    return null;
  }
}

module.exports = {
  initializeRedis,
  getRedisClient,
  closeRedis,
  redisClient,
  setWithExpiry,
  get,
  del,
  exists,
  expire,
  ttl,
  keys,
  hset,
  hget,
  hgetall,
  hdel,
  lpush,
  rpop,
  lrange,
  llen,
  sadd,
  srem,
  smembers,
  sismember,
  incr,
  decr,
  flushdb,
  info
}; 