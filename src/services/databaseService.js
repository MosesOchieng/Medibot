const { query } = require('../database/connection');
const logger = require('../utils/logger');

class DatabaseService {
  // User management
  async createUser(phone, userData = {}) {
    try {
      const result = await query(`
        INSERT INTO users (phone, name, email, date_of_birth, gender, address, emergency_contact, medical_history)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (phone) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [phone, userData.name, userData.email, userData.dateOfBirth, userData.gender, userData.address, userData.emergencyContact, userData.medicalHistory]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserByPhone(phone) {
    try {
      const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user by phone:', error);
      throw error;
    }
  }

  // User health data
  async getUserHealthData(phone) {
    try {
      const result = await query('SELECT * FROM user_health_data WHERE phone = $1', [phone]);
      if (result.rows.length === 0) {
        // Create default health data
        const user = await this.getUserByPhone(phone);
        if (user) {
          await query(`
            INSERT INTO user_health_data (user_id, phone, conditions, medications, preferred_services, payment_methods, notification_settings)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [user.id, phone, '[]', '[]', '[]', '[]', '{"medication": true, "followup": true, "healthTips": true, "loyalty": true}']);
          
          const newResult = await query('SELECT * FROM user_health_data WHERE phone = $1', [phone]);
          return newResult.rows[0];
        }
      }
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user health data:', error);
      throw error;
    }
  }

  async updateUserHealthData(phone, healthData) {
    try {
      const result = await query(`
        UPDATE user_health_data 
        SET conditions = $2, medications = $3, preferred_services = $4, payment_methods = $5, 
            notification_settings = $6, visit_count = $7, last_visit = $8, updated_at = CURRENT_TIMESTAMP
        WHERE phone = $1
        RETURNING *
      `, [phone, JSON.stringify(healthData.conditions || []), JSON.stringify(healthData.medications || []), 
          JSON.stringify(healthData.preferredServices || []), JSON.stringify(healthData.paymentMethods || []),
          JSON.stringify(healthData.notifications || {}), healthData.visitCount || 0, healthData.lastVisit]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating user health data:', error);
      throw error;
    }
  }

  // Loyalty program
  async getLoyaltyPoints(phone) {
    try {
      const result = await query('SELECT * FROM loyalty_points WHERE phone = $1', [phone]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting loyalty points:', error);
      throw error;
    }
  }

  async addLoyaltyPoints(phone, points, reason, bookingId = null) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user) throw new Error('User not found');

      // Add transaction
      await query(`
        INSERT INTO loyalty_transactions (user_id, phone, points, type, reason, booking_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [user.id, phone, points, 'earned', reason, bookingId]);

      // Update or create loyalty points
      const result = await query(`
        INSERT INTO loyalty_points (user_id, phone, points, total_earned, level)
        VALUES ($1, $2, $3, $3, 'Bronze')
        ON CONFLICT (phone) DO UPDATE SET
          points = loyalty_points.points + $3,
          total_earned = loyalty_points.total_earned + $3,
          level = CASE 
            WHEN loyalty_points.points + $3 >= 1000 THEN 'Gold'
            WHEN loyalty_points.points + $3 >= 500 THEN 'Silver'
            ELSE 'Bronze'
          END,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [user.id, phone, points]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error adding loyalty points:', error);
      throw error;
    }
  }

  // Referral system
  async createReferralCode(phone) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user) throw new Error('User not found');

      const code = `MEDI${phone.slice(-4)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const result = await query(`
        INSERT INTO referral_codes (user_id, phone, code)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [user.id, phone, code]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating referral code:', error);
      throw error;
    }
  }

  async getReferralCode(code) {
    try {
      const result = await query('SELECT * FROM referral_codes WHERE code = $1 AND is_active = true', [code]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting referral code:', error);
      throw error;
    }
  }

  async useReferralCode(code, referredPhone, bookingId) {
    try {
      const referralCode = await this.getReferralCode(code);
      if (!referralCode) throw new Error('Invalid referral code');

      const referredUser = await this.getUserByPhone(referredPhone);
      if (!referredUser) throw new Error('Referred user not found');

      // Record usage
      await query(`
        INSERT INTO referral_usage (referral_code_id, referrer_id, referred_id, referrer_phone, referred_phone, booking_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [referralCode.id, referralCode.user_id, referredUser.id, referralCode.phone, referredPhone, bookingId]);

      // Award points to both users
      await this.addLoyaltyPoints(referralCode.phone, 500, 'Referral reward', bookingId);
      await this.addLoyaltyPoints(referredPhone, 500, 'Referral reward', bookingId);

      // Update referral code usage
      await query(`
        UPDATE referral_codes 
        SET uses = uses + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [referralCode.id]);

      return true;
    } catch (error) {
      logger.error('Error using referral code:', error);
      throw error;
    }
  }

  // Voice processing
  async saveVoiceProcessing(phone, audioUrl, transcription, aiAnalysis, symptoms, urgencyLevel, recommendedServices) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user) throw new Error('User not found');

      const result = await query(`
        INSERT INTO voice_processing (user_id, phone, audio_url, transcription, ai_analysis, symptoms_extracted, urgency_level, recommended_services, processing_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
        RETURNING *
      `, [user.id, phone, audioUrl, transcription, aiAnalysis, JSON.stringify(symptoms), urgencyLevel, JSON.stringify(recommendedServices)]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving voice processing:', error);
      throw error;
    }
  }

  // AI recommendations
  async saveAIRecommendation(phone, type, title, message, healthData) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user) throw new Error('User not found');

      const result = await query(`
        INSERT INTO ai_recommendations (user_id, phone, recommendation_type, title, message, health_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [user.id, phone, type, title, message, JSON.stringify(healthData)]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving AI recommendation:', error);
      throw error;
    }
  }

  // Session management
  async saveUserSession(phone, sessionData, currentState) {
    try {
      const user = await this.getUserByPhone(phone);
      if (!user) throw new Error('User not found');

      // Deactivate existing sessions
      await query(`
        UPDATE user_sessions 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE phone = $1 AND is_active = true
      `, [phone]);

      // Create new session
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const result = await query(`
        INSERT INTO user_sessions (user_id, phone, session_data, current_state, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [user.id, phone, JSON.stringify(sessionData), currentState, expiresAt]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error saving user session:', error);
      throw error;
    }
  }

  async getUserSession(phone) {
    try {
      const result = await query(`
        SELECT * FROM user_sessions 
        WHERE phone = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC 
        LIMIT 1
      `, [phone]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user session:', error);
      throw error;
    }
  }

  // Van tracking
  async updateVanLocation(bookingId, lat, lng, eta, status, locationName) {
    try {
      const result = await query(`
        INSERT INTO van_tracking (booking_id, current_lat, current_lng, eta_minutes, status, location_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (booking_id) DO UPDATE SET
          current_lat = EXCLUDED.current_lat,
          current_lng = EXCLUDED.current_lng,
          eta_minutes = EXCLUDED.eta_minutes,
          status = EXCLUDED.status,
          location_name = EXCLUDED.location_name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [bookingId, lat, lng, eta, status, locationName]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating van location:', error);
      throw error;
    }
  }

  async getVanTracking(bookingId) {
    try {
      const result = await query('SELECT * FROM van_tracking WHERE booking_id = $1', [bookingId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting van tracking:', error);
      throw error;
    }
  }

  // Health tips
  async getHealthTips(condition) {
    try {
      const result = await query('SELECT * FROM health_tips WHERE condition = $1 AND is_active = true', [condition]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting health tips:', error);
      throw error;
    }
  }

  // Initialize default health tips
  async initializeHealthTips() {
    try {
      const tips = [
        { condition: 'UTI', tip_text: '💧 Drink 8-10 glasses of water daily', category: 'prevention' },
        { condition: 'UTI', tip_text: '🚫 Avoid caffeine and alcohol', category: 'prevention' },
        { condition: 'UTI', tip_text: '🧼 Maintain good hygiene practices', category: 'prevention' },
        { condition: 'UTI', tip_text: '🍓 Eat cranberries or take supplements', category: 'prevention' },
        { condition: 'diabetes', tip_text: '📊 Monitor blood sugar regularly', category: 'management' },
        { condition: 'diabetes', tip_text: '🥗 Follow a balanced diet plan', category: 'management' },
        { condition: 'diabetes', tip_text: '🏃‍♂️ Exercise for 30 minutes daily', category: 'management' },
        { condition: 'diabetes', tip_text: '💊 Take medications as prescribed', category: 'management' },
        { condition: 'hypertension', tip_text: '🧂 Reduce salt intake', category: 'management' },
        { condition: 'hypertension', tip_text: '🏃‍♀️ Exercise regularly', category: 'management' },
        { condition: 'hypertension', tip_text: '😴 Get 7-8 hours of sleep', category: 'management' },
        { condition: 'hypertension', tip_text: '🧘‍♀️ Practice stress management', category: 'management' },
        { condition: 'mental_health', tip_text: '🧘‍♀️ Practice mindfulness daily', category: 'wellness' },
        { condition: 'mental_health', tip_text: '👥 Stay connected with loved ones', category: 'wellness' },
        { condition: 'mental_health', tip_text: '🌞 Get regular sunlight exposure', category: 'wellness' },
        { condition: 'mental_health', tip_text: '📞 Reach out for professional help', category: 'wellness' }
      ];

      for (const tip of tips) {
        await query(`
          INSERT INTO health_tips (condition, tip_text, category)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [tip.condition, tip.tip_text, tip.category]);
      }

      logger.info('Health tips initialized successfully');
    } catch (error) {
      logger.error('Error initializing health tips:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService(); 