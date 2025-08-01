const express = require('express');
const router = express.Router();
const { bookingService } = require('../services/booking');
const logger = require('../utils/logger');

// Get user bookings
router.get('/user/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { limit } = req.query;
    const bookings = await bookingService.getUserBookings(phone, limit);
    res.json(bookings);
  } catch (error) {
    logger.error('Get user bookings error:', error);
    res.status(500).json({
      error: 'Failed to get user bookings'
    });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await bookingService.getBookingById(id);
    
    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found'
      });
    }
    
    res.json(booking);
  } catch (error) {
    logger.error('Get booking error:', error);
    res.status(500).json({
      error: 'Failed to get booking'
    });
  }
});

// Update booking status
router.put('/:id/status', async (req, res) => {
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
router.put('/:id/cancel', async (req, res) => {
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
router.put('/:id/reschedule', async (req, res) => {
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

// Get booking stats
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await bookingService.getBookingStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get booking stats error:', error);
    res.status(500).json({
      error: 'Failed to get booking stats'
    });
  }
});

module.exports = router; 