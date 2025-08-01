const express = require('express');
const router = express.Router();
const { paymentService } = require('../services/payment');
const logger = require('../utils/logger');

// M-Pesa callback webhook
router.post('/mpesa/callback', async (req, res) => {
  try {
    const result = await paymentService.handleMpesaCallback(req.body);
    res.json(result);
  } catch (error) {
    logger.error('M-Pesa callback error:', error);
    res.status(500).json({
      error: 'Callback processing failed'
    });
  }
});

// Verify M-Pesa payment
router.post('/mpesa/verify', async (req, res) => {
  try {
    const { checkoutRequestId } = req.body;
    const result = await paymentService.verifyMpesaPayment(checkoutRequestId);
    res.json(result);
  } catch (error) {
    logger.error('M-Pesa verification error:', error);
    res.status(500).json({
      error: 'Payment verification failed'
    });
  }
});

// Get payment stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await paymentService.getPaymentStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get payment stats error:', error);
    res.status(500).json({
      error: 'Failed to get payment stats'
    });
  }
});

module.exports = router; 