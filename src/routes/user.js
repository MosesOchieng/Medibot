const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const logger = require('../utils/logger');

// Get user by phone
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user'
    });
  }
});

// Update user profile
router.put('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { name, email, date_of_birth, gender, address, emergency_contact, medical_history } = req.body;
    
    const result = await query(`
      UPDATE users 
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          date_of_birth = COALESCE($3, date_of_birth),
          gender = COALESCE($4, gender),
          address = COALESCE($5, address),
          emergency_contact = COALESCE($6, emergency_contact),
          medical_history = COALESCE($7, medical_history),
          updated_at = CURRENT_TIMESTAMP
      WHERE phone = $8
      RETURNING *
    `, [name, email, date_of_birth, gender, address, emergency_contact, medical_history, phone]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({
      error: 'Failed to update user'
    });
  }
});

// Get user medical records
router.get('/:phone/medical-records', async (req, res) => {
  try {
    const { phone } = req.params;
    const { limit = 10 } = req.query;
    
    const result = await query(`
      SELECT mr.*, b.service_type, b.scheduled_time
      FROM medical_records mr
      JOIN bookings b ON mr.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE u.phone = $1
      ORDER BY mr.created_at DESC
      LIMIT $2
    `, [phone, limit]);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Get medical records error:', error);
    res.status(500).json({
      error: 'Failed to get medical records'
    });
  }
});

// Add medical record
router.post('/:phone/medical-records', async (req, res) => {
  try {
    const { phone } = req.params;
    const { booking_id, diagnosis, prescription, vital_signs, notes, follow_up_date } = req.body;
    
    // Get user ID
    const userResult = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    const userId = userResult.rows[0].id;
    
    const result = await query(`
      INSERT INTO medical_records (user_id, booking_id, diagnosis, prescription, vital_signs, notes, follow_up_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [userId, booking_id, diagnosis, prescription, vital_signs, notes, follow_up_date]);
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Add medical record error:', error);
    res.status(500).json({
      error: 'Failed to add medical record'
    });
  }
});

module.exports = router; 