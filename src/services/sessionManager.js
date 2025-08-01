const { redisClient } = require('./redis');
const logger = require('../utils/logger');

const SESSION_PREFIX = 'medipod:session:';
const SESSION_TTL = 3600; // 1 hour

class SessionManager {
  constructor() {
    this.redis = redisClient;
  }

  async getUserSession(phone) {
    try {
      const key = `${SESSION_PREFIX}${phone}`;
      const sessionData = await this.redis.get(key);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        // Extend session TTL on access
        await this.redis.expire(key, SESSION_TTL);
        return session;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting user session:', error);
      return null;
    }
  }

  async updateUserSession(phone, sessionData) {
    try {
      const key = `${SESSION_PREFIX}${phone}`;
      const session = {
        ...sessionData,
        updatedAt: new Date().toISOString()
      };
      
      await this.redis.setex(key, SESSION_TTL, JSON.stringify(session));
      logger.info(`Session updated for ${phone}`);
      return session;
    } catch (error) {
      logger.error('Error updating user session:', error);
      throw error;
    }
  }

  async deleteUserSession(phone) {
    try {
      const key = `${SESSION_PREFIX}${phone}`;
      await this.redis.del(key);
      logger.info(`Session deleted for ${phone}`);
    } catch (error) {
      logger.error('Error deleting user session:', error);
    }
  }

  async getActiveSessions() {
    try {
      const pattern = `${SESSION_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      const sessions = [];
      
      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          sessions.push(JSON.parse(sessionData));
        }
      }
      
      return sessions;
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      return [];
    }
  }

  async getSessionStats() {
    try {
      const pattern = `${SESSION_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      const stats = {
        totalSessions: keys.length,
        states: {},
        recentActivity: []
      };
      
      for (const key of keys) {
        const sessionData = await this.redis.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          stats.states[session.state] = (stats.states[session.state] || 0) + 1;
          
          if (session.updatedAt) {
            const updatedAt = new Date(session.updatedAt);
            const now = new Date();
            const diffMinutes = (now - updatedAt) / (1000 * 60);
            
            if (diffMinutes < 30) {
              stats.recentActivity.push({
                phone: session.phone,
                state: session.state,
                lastActivity: session.updatedAt
              });
            }
          }
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting session stats:', error);
      return { totalSessions: 0, states: {}, recentActivity: [] };
    }
  }

  async cleanupExpiredSessions() {
    try {
      const pattern = `${SESSION_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      let cleanedCount = 0;
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
          cleanedCount++;
        }
      }
      
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

// Singleton instance
const sessionManager = new SessionManager();

// Export functions for backward compatibility
async function getUserSession(phone) {
  return sessionManager.getUserSession(phone);
}

async function updateUserSession(phone, sessionData) {
  return sessionManager.updateUserSession(phone, sessionData);
}

async function deleteUserSession(phone) {
  return sessionManager.deleteUserSession(phone);
}

module.exports = {
  SessionManager,
  sessionManager,
  getUserSession,
  updateUserSession,
  deleteUserSession
}; 