const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

async function initializeDatabase() {
  try {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      logger.warn('⚠️  DATABASE_URL not provided. Database features will be disabled.');
      return null;
    }

    pool = new Pool({
      connectionString: connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('✅ Database connected successfully');
    
    // Initialize tables if they don't exist
    await initializeTables();
    
    return pool;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    logger.warn('⚠️  Running without database. Some features will be limited.');
    return null;
  }
}

async function initializeTables() {
  try {
    const client = await pool.connect();
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        email VARCHAR(100),
        date_of_birth DATE,
        gender VARCHAR(10),
        address TEXT,
        emergency_contact VARCHAR(20),
        medical_history TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        service_fee DECIMAL(10,2) NOT NULL,
        logistics_fee DECIMAL(10,2) NOT NULL,
        total_fee DECIMAL(10,2) NOT NULL,
        location TEXT NOT NULL,
        coordinates_lat DECIMAL(10,8),
        coordinates_lng DECIMAL(10,8),
        zone VARCHAR(5) NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        time_slot VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        payment_status VARCHAR(20) DEFAULT 'pending',
        payment_method VARCHAR(20),
        payment_reference VARCHAR(100),
        prediagnosis TEXT,
        notes TEXT,
        vehicle_id VARCHAR(20),
        eta_minutes INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id),
        amount DECIMAL(10,2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        reference VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        phone VARCHAR(20) NOT NULL,
        description TEXT,
        mpesa_response JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Vehicles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        capacity INTEGER NOT NULL,
        current_lat DECIMAL(10,8),
        current_lng DECIMAL(10,8),
        status VARCHAR(20) DEFAULT 'available',
        driver_name VARCHAR(100),
        driver_phone VARCHAR(20),
        equipment JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Medical records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        booking_id UUID REFERENCES bookings(id),
        diagnosis TEXT,
        prescription TEXT,
        vital_signs JSONB,
        notes TEXT,
        follow_up_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Loyalty points table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        points INTEGER NOT NULL DEFAULT 0,
        total_earned INTEGER NOT NULL DEFAULT 0,
        total_redeemed INTEGER NOT NULL DEFAULT 0,
        level VARCHAR(20) DEFAULT 'Bronze',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Loyalty transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        points INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'earned', 'redeemed', 'expired'
        reason VARCHAR(200) NOT NULL,
        booking_id UUID REFERENCES bookings(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Referral codes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        uses INTEGER DEFAULT 0,
        max_uses INTEGER DEFAULT 10,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Referral usage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referral_code_id UUID REFERENCES referral_codes(id),
        referrer_id UUID REFERENCES users(id),
        referred_id UUID REFERENCES users(id),
        referrer_phone VARCHAR(20) NOT NULL,
        referred_phone VARCHAR(20) NOT NULL,
        points_awarded INTEGER DEFAULT 500,
        booking_id UUID REFERENCES bookings(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Service bundles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_bundles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        services JSONB NOT NULL,
        discount_percentage INTEGER NOT NULL,
        original_price DECIMAL(10,2) NOT NULL,
        discounted_price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bundle bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bundle_bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        bundle_id UUID REFERENCES service_bundles(id),
        booking_id UUID REFERENCES bookings(id),
        discount_applied DECIMAL(10,2) NOT NULL,
        final_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Voice processing table
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_processing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        audio_url TEXT NOT NULL,
        transcription TEXT,
        ai_analysis TEXT,
        symptoms_extracted JSONB,
        urgency_level VARCHAR(20),
        recommended_services JSONB,
        processing_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // AI recommendations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        recommendation_type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        health_data JSONB,
        is_actioned BOOLEAN DEFAULT false,
        actioned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Health tips table
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_tips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        condition VARCHAR(100) NOT NULL,
        tip_text TEXT NOT NULL,
        category VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User health data table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_health_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        conditions JSONB DEFAULT '[]',
        medications JSONB DEFAULT '[]',
        preferred_services JSONB DEFAULT '[]',
        payment_methods JSONB DEFAULT '[]',
        notification_settings JSONB DEFAULT '{"medication": true, "followup": true, "healthTips": true, "loyalty": true}',
        visit_count INTEGER DEFAULT 0,
        last_visit TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Van tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS van_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id),
        vehicle_id VARCHAR(20) REFERENCES vehicles(id),
        current_lat DECIMAL(10,8),
        current_lng DECIMAL(10,8),
        eta_minutes INTEGER,
        status VARCHAR(20) DEFAULT 'en_route',
        location_name VARCHAR(200),
        route_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Session management table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone VARCHAR(20) NOT NULL,
        session_data JSONB NOT NULL,
        current_state VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_time ON bookings(scheduled_time);
      CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_phone ON notifications(phone);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_loyalty_points_phone ON loyalty_points(phone);
      CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_phone ON loyalty_transactions(phone);
      CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
      CREATE INDEX IF NOT EXISTS idx_referral_codes_phone ON referral_codes(phone);
      CREATE INDEX IF NOT EXISTS idx_voice_processing_phone ON voice_processing(phone);
      CREATE INDEX IF NOT EXISTS idx_voice_processing_status ON voice_processing(processing_status);
      CREATE INDEX IF NOT EXISTS idx_ai_recommendations_phone ON ai_recommendations(phone);
      CREATE INDEX IF NOT EXISTS idx_user_health_data_phone ON user_health_data(phone);
      CREATE INDEX IF NOT EXISTS idx_van_tracking_booking_id ON van_tracking(booking_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_phone ON user_sessions(phone);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
    `);

    client.release();
    logger.info('✅ Database tables initialized successfully');
    
    // Initialize default data
    await initializeDefaultData();
  } catch (error) {
    logger.error('❌ Database table initialization failed:', error);
    throw error;
  }
}

async function initializeDefaultData() {
  try {
    const client = await pool.connect();
    
    // Initialize health tips
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
      await client.query(`
        INSERT INTO health_tips (condition, tip_text, category)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [tip.condition, tip.tip_text, tip.category]);
    }

    // Initialize service bundles
    const bundles = [
      {
        name: '🩸 Complete Diabetes Care Package',
        description: 'Comprehensive diabetes monitoring and consultation',
        services: ['Blood Pressure / Diabetes Check', 'General Consultation'],
        discount_percentage: 20,
        original_price: 900,
        discounted_price: 720
      },
      {
        name: "🧬 Women's Health Plus",
        description: 'Complete women health screening and consultation',
        services: ["Women's Health", 'General Consultation'],
        discount_percentage: 15,
        original_price: 1200,
        discounted_price: 1020
      },
      {
        name: '👨‍👩‍👧‍👦 Family Health Package',
        description: 'Family health checkup package',
        services: ['Child Check-Up', 'General Consultation'],
        discount_percentage: 25,
        original_price: 1000,
        discounted_price: 750
      }
    ];

    for (const bundle of bundles) {
      await client.query(`
        INSERT INTO service_bundles (name, description, services, discount_percentage, original_price, discounted_price)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [bundle.name, bundle.description, JSON.stringify(bundle.services), bundle.discount_percentage, bundle.original_price, bundle.discounted_price]);
    }

    client.release();
    logger.info('✅ Default data initialized successfully');
  } catch (error) {
    logger.error('❌ Default data initialization failed:', error);
    throw error;
  }
}

async function getPool() {
  if (!pool) {
    logger.warn('Database not initialized. Returning null.');
    return null;
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool();
  if (!client) {
    logger.warn('Database not available. Query skipped.');
    return { rows: [] };
  }
  
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  query,
  closeDatabase
}; 