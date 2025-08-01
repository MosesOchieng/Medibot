const express = require('express');
const router = express.Router();
const { sessionManager } = require('../services/sessionManager');
const { bookingService } = require('../services/booking');
const { paymentService } = require('../services/payment');
const { notificationService } = require('../services/notification');
const logger = require('../utils/logger');

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      sessionStats,
      bookingStats,
      paymentStats,
      notificationStats
    ] = await Promise.all([
      sessionManager.getSessionStats(),
      bookingService.getBookingStats(),
      paymentService.getPaymentStats(),
      notificationService.getNotificationStats()
    ]);

    res.json({
      sessions: sessionStats,
      bookings: bookingStats,
      payments: paymentStats,
      notifications: notificationStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to get dashboard stats'
    });
  }
});

// Get active sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await sessionManager.getActiveSessions();
    res.json(sessions);
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to get sessions'
    });
  }
});

// Get today's bookings
router.get('/bookings/today', async (req, res) => {
  try {
    const bookings = await bookingService.getTodayBookings();
    res.json(bookings);
  } catch (error) {
    logger.error('Get today bookings error:', error);
    res.status(500).json({
      error: 'Failed to get today bookings'
    });
  }
});

// Get bookings by status
router.get('/bookings/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { limit } = req.query;
    const bookings = await bookingService.getBookingsByStatus(status, limit);
    res.json(bookings);
  } catch (error) {
    logger.error('Get bookings by status error:', error);
    res.status(500).json({
      error: 'Failed to get bookings'
    });
  }
});

// Update booking status
router.put('/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const booking = await bookingService.updateBookingStatus(id, status, notes);
    res.json(booking);
  } catch (error) {
    logger.error('Update booking status error:', error);
    res.status(500).json({
      error: 'Failed to update booking status'
    });
  }
});

// Cancel booking
router.put('/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const booking = await bookingService.cancelBooking(id, reason);
    res.json(booking);
  } catch (error) {
    logger.error('Cancel booking error:', error);
    res.status(500).json({
      error: 'Failed to cancel booking'
    });
  }
});

// Reschedule booking
router.put('/bookings/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { newScheduledTime, newTimeSlot } = req.body;
    
    const booking = await bookingService.rescheduleBooking(id, newScheduledTime, newTimeSlot);
    res.json(booking);
  } catch (error) {
    logger.error('Reschedule booking error:', error);
    res.status(500).json({
      error: 'Failed to reschedule booking'
    });
  }
});

// Get payment stats
router.get('/payments/stats', async (req, res) => {
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

// Get notification stats
router.get('/notifications/stats', async (req, res) => {
  try {
    const stats = await notificationService.getNotificationStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      error: 'Failed to get notification stats'
    });
  }
});

// Send bulk notification
router.post('/notifications/bulk', async (req, res) => {
  try {
    const { phones, message, type } = req.body;
    
    if (!phones || !message) {
      return res.status(400).json({
        error: 'Missing required fields: phones, message'
      });
    }

    const results = await notificationService.sendBulkNotification(phones, message, type);
    res.json(results);
  } catch (error) {
    logger.error('Bulk notification error:', error);
    res.status(500).json({
      error: 'Failed to send bulk notification'
    });
  }
});

// Cleanup expired sessions
router.post('/sessions/cleanup', async (req, res) => {
  try {
    const cleanedCount = await sessionManager.cleanupExpiredSessions();
    res.json({
      success: true,
      cleanedCount
    });
  } catch (error) {
    logger.error('Session cleanup error:', error);
    res.status(500).json({
      error: 'Failed to cleanup sessions'
    });
  }
});

module.exports = router; 