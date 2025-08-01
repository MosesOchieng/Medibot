const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { query } = require('../database/connection');
const logger = require('../utils/logger');
const { getNearestVehicle } = require('./logistics');

class BookingService {
  constructor() {
    this.statuses = {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      RESCHEDULED: 'rescheduled'
    };

    this.paymentStatuses = {
      PENDING: 'pending',
      PAID: 'paid',
      FAILED: 'failed',
      REFUNDED: 'refunded'
    };
  }

  async createBooking(sessionData, userPhone) {
    try {
      logger.info(`Creating booking for ${userPhone}`);

      // Get or create user
      const user = await this.getOrCreateUser(userPhone);

      // Calculate scheduled time
      const scheduledTime = this.calculateScheduledTime(sessionData.selectedTimeSlot);

      // Get nearest vehicle
      const vehicleAssignment = await getNearestVehicle(sessionData.logistics);

      // Create booking record
      const bookingData = {
        id: uuidv4(),
        user_id: user.id,
        phone: userPhone,
        service_type: sessionData.selectedService.name,
        service_fee: sessionData.selectedService.price,
        logistics_fee: sessionData.logistics.fee,
        total_fee: sessionData.selectedService.price + sessionData.logistics.fee,
        location: sessionData.location,
        coordinates_lat: sessionData.logistics.coordinates?.lat || null,
        coordinates_lng: sessionData.logistics.coordinates?.lng || null,
        zone: sessionData.logistics.zone,
        scheduled_time: scheduledTime,
        time_slot: sessionData.selectedTimeSlot.name,
        status: this.statuses.PENDING,
        payment_status: this.paymentStatuses.PAID, // Assuming logistics fee is already paid
        payment_method: sessionData.paymentMethod,
        payment_reference: sessionData.paymentReference,
        prediagnosis: sessionData.prediagnosis || null,
        vehicle_id: vehicleAssignment?.vehicle?.id || null,
        eta_minutes: sessionData.logistics.eta
      };

      // Insert into database
      const result = await query(`
        INSERT INTO bookings (
          id, user_id, phone, service_type, service_fee, logistics_fee, total_fee,
          location, coordinates_lat, coordinates_lng, zone, scheduled_time,
          time_slot, status, payment_status, payment_method, payment_reference,
          prediagnosis, vehicle_id, eta_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
        bookingData.id, bookingData.user_id, bookingData.phone, bookingData.service_type,
        bookingData.service_fee, bookingData.logistics_fee, bookingData.total_fee,
        bookingData.location, bookingData.coordinates_lat, bookingData.coordinates_lng,
        bookingData.zone, bookingData.scheduled_time, bookingData.time_slot,
        bookingData.status, bookingData.payment_status, bookingData.payment_method,
        bookingData.payment_reference, bookingData.prediagnosis, bookingData.vehicle_id,
        bookingData.eta_minutes
      ]);

      const booking = result.rows[0];

      // Log booking creation
      logger.logBooking(booking);

      // Send notifications
      await this.sendBookingNotifications(booking);

      return {
        id: booking.id,
        eta: `${booking.eta_minutes} minutes`,
        countdown: this.calculateCountdown(booking.scheduled_time),
        serviceFee: booking.service_fee,
        vehicleId: booking.vehicle_id,
        scheduledTime: booking.scheduled_time
      };

    } catch (error) {
      logger.error('Error creating booking:', error);
      throw new Error(`Failed to create booking: ${error.message}`);
    }
  }

  async getOrCreateUser(phone) {
    try {
      // Try to get existing user
      let result = await query('SELECT * FROM users WHERE phone = $1', [phone]);
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create new user
      const userId = uuidv4();
      result = await query(`
        INSERT INTO users (id, phone, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `, [userId, phone]);

      logger.info(`New user created: ${phone}`);
      return result.rows[0];

    } catch (error) {
      logger.error('Error getting/creating user:', error);
      throw error;
    }
  }

  calculateScheduledTime(timeSlot) {
    const now = moment();
    const today = now.format('YYYY-MM-DD');
    
    let scheduledTime;
    
    switch (timeSlot.start) {
      case '09:00':
        scheduledTime = moment(`${today} 09:00`);
        break;
      case '11:00':
        scheduledTime = moment(`${today} 11:00`);
        break;
      case '14:00':
        scheduledTime = moment(`${today} 14:00`);
        break;
      default:
        scheduledTime = moment(`${today} 11:00`);
    }

    // If the time has passed today, schedule for tomorrow
    if (scheduledTime.isBefore(now)) {
      scheduledTime.add(1, 'day');
    }

    return scheduledTime.toDate();
  }

  calculateCountdown(scheduledTime) {
    const now = moment();
    const scheduled = moment(scheduledTime);
    const diffMinutes = scheduled.diff(now, 'minutes');
    
    if (diffMinutes <= 0) {
      return 'Arriving soon';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  async getUserBookings(phone, limit = 10) {
    try {
      const result = await query(`
        SELECT b.*, u.name, u.email
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.phone = $1
        ORDER BY b.created_at DESC
        LIMIT $2
      `, [phone, limit]);

      return result.rows.map(booking => ({
        id: booking.id,
        serviceType: booking.service_type,
        scheduledTime: booking.scheduled_time,
        status: booking.status,
        location: booking.location,
        totalFee: booking.total_fee,
        eta: booking.eta_minutes,
        createdAt: booking.created_at
      }));

    } catch (error) {
      logger.error('Error getting user bookings:', error);
      throw error;
    }
  }

  async getBookingById(bookingId) {
    try {
      const result = await query(`
        SELECT b.*, u.name, u.email, u.emergency_contact
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.id = $1
      `, [bookingId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting booking by ID:', error);
      throw error;
    }
  }

  async updateBookingStatus(bookingId, status, notes = null) {
    try {
      const result = await query(`
        UPDATE bookings 
        SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [status, notes, bookingId]);

      if (result.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const booking = result.rows[0];
      logger.info(`Booking status updated: ${bookingId} -> ${status}`);

      // Send status update notification
      await this.sendStatusUpdateNotification(booking);

      return booking;

    } catch (error) {
      logger.error('Error updating booking status:', error);
      throw error;
    }
  }

  async cancelBooking(bookingId, reason = null) {
    try {
      const booking = await this.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === this.statuses.COMPLETED) {
        throw new Error('Cannot cancel completed booking');
      }

      const result = await query(`
        UPDATE bookings 
        SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [this.statuses.CANCELLED, reason, bookingId]);

      const updatedBooking = result.rows[0];
      logger.info(`Booking cancelled: ${bookingId}`);

      // Send cancellation notification
      await this.sendCancellationNotification(updatedBooking);

      return updatedBooking;

    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  async rescheduleBooking(bookingId, newScheduledTime, newTimeSlot) {
    try {
      const booking = await this.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === this.statuses.COMPLETED) {
        throw new Error('Cannot reschedule completed booking');
      }

      const result = await query(`
        UPDATE bookings 
        SET scheduled_time = $1, time_slot = $2, status = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [newScheduledTime, newTimeSlot, this.statuses.RESCHEDULED, bookingId]);

      const updatedBooking = result.rows[0];
      logger.info(`Booking rescheduled: ${bookingId}`);

      // Send reschedule notification
      await this.sendRescheduleNotification(updatedBooking);

      return updatedBooking;

    } catch (error) {
      logger.error('Error rescheduling booking:', error);
      throw error;
    }
  }

  async getBookingsByStatus(status, limit = 50) {
    try {
      const result = await query(`
        SELECT b.*, u.name, u.phone
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.status = $1
        ORDER BY b.scheduled_time ASC
        LIMIT $2
      `, [status, limit]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting bookings by status:', error);
      throw error;
    }
  }

  async getTodayBookings() {
    try {
      const today = moment().format('YYYY-MM-DD');
      const result = await query(`
        SELECT b.*, u.name, u.phone
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE DATE(b.scheduled_time) = $1
        AND b.status IN ($2, $3, $4)
        ORDER BY b.scheduled_time ASC
      `, [today, this.statuses.PENDING, this.statuses.CONFIRMED, this.statuses.IN_PROGRESS]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting today bookings:', error);
      throw error;
    }
  }

  async getBookingStats() {
    try {
      const result = await query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(total_fee) as total_revenue
        FROM bookings 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY status
      `);

      const stats = {
        total: 0,
        revenue: 0,
        byStatus: {}
      };

      result.rows.forEach(row => {
        stats.total += parseInt(row.count);
        stats.revenue += parseFloat(row.total_revenue || 0);
        stats.byStatus[row.status] = {
          count: parseInt(row.count),
          revenue: parseFloat(row.total_revenue || 0)
        };
      });

      return stats;

    } catch (error) {
      logger.error('Error getting booking stats:', error);
      throw error;
    }
  }

  // Notification methods
  async sendBookingNotifications(booking) {
    try {
      // Send confirmation to user
      await this.sendBookingConfirmation(booking);
      
      // Notify medical team
      await this.notifyMedicalTeam(booking);
      
      // Update vehicle assignment
      if (booking.vehicle_id) {
        await this.updateVehicleAssignment(booking);
      }

    } catch (error) {
      logger.error('Error sending booking notifications:', error);
    }
  }

  async sendBookingConfirmation(booking) {
    // This would integrate with notification service
    logger.info(`Booking confirmation sent for: ${booking.id}`);
  }

  async notifyMedicalTeam(booking) {
    // This would integrate with medical team notification system
    logger.info(`Medical team notified for booking: ${booking.id}`);
  }

  async updateVehicleAssignment(booking) {
    // This would integrate with vehicle tracking system
    logger.logVehicleAssignment(booking.vehicle_id, booking.id, booking.location);
  }

  async sendStatusUpdateNotification(booking) {
    // This would integrate with notification service
    logger.info(`Status update notification sent for: ${booking.id}`);
  }

  async sendCancellationNotification(booking) {
    // This would integrate with notification service
    logger.info(`Cancellation notification sent for: ${booking.id}`);
  }

  async sendRescheduleNotification(booking) {
    // This would integrate with notification service
    logger.info(`Reschedule notification sent for: ${booking.id}`);
  }
}

// Singleton instance
const bookingService = new BookingService();

// Export functions for backward compatibility
async function createBooking(sessionData, userPhone) {
  return bookingService.createBooking(sessionData, userPhone);
}

module.exports = {
  BookingService,
  bookingService,
  createBooking
}; 