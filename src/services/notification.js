const twilio = require('twilio');
const logger = require('../utils/logger');
const { query } = require('../database/connection');

class NotificationService {
  constructor() {
    // Only initialize Twilio if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      // Validate Account SID format
      if (!process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
        console.error('❌ Invalid TWILIO_ACCOUNT_SID format. Must start with "AC"');
        this.client = null;
      } else {
        this.client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
      }
    } else {
      this.client = null;
      console.warn('⚠️  Twilio credentials not provided. WhatsApp/SMS features will be disabled.');
    }
    
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.whatsappNumber = process.env.TWILIO_PHONE_NUMBER;
    this.contentSid = process.env.TWILIO_CONTENT_SID;
  }

  async sendNotification(notificationData) {
    try {
      const { type, phone, message, title, priority = 'normal' } = notificationData;
      
      logger.info(`Sending ${type} notification to ${phone}`);

      // Store notification record
      const notificationId = await this.storeNotification(notificationData);

      let result;
      switch (type.toLowerCase()) {
        case 'whatsapp':
          result = await this.sendWhatsAppMessage(phone, message);
          break;
        
        case 'sms':
          result = await this.sendSMS(phone, message);
          break;
        
        case 'both':
          const whatsappResult = await this.sendWhatsAppMessage(phone, message);
          const smsResult = await this.sendSMS(phone, message);
          result = { whatsapp: whatsappResult, sms: smsResult };
          break;
        
        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }

      // Update notification status
      await this.updateNotificationStatus(notificationId, 'sent');

      logger.logNotification(type, phone, 'sent');
      return result;

    } catch (error) {
      logger.error('Error sending notification:', error);
      
      // Update notification status to failed
      if (notificationData.id) {
        await this.updateNotificationStatus(notificationData.id, 'failed');
      }
      
      throw error;
    }
  }

  async sendWhatsAppMessage(to, message, contentVariables = null) {
    try {
      if (!this.client) {
        logger.warn('Twilio client not initialized. Skipping WhatsApp message.');
        return {
          success: false,
          message: 'Twilio not configured',
          status: 'skipped'
        };
      }

      const messageData = {
        from: this.whatsappNumber,
        to: `whatsapp:${to}`
      };

      // Use ContentSid template if provided and contentVariables are available
      if (this.contentSid && contentVariables) {
        messageData.contentSid = this.contentSid;
        messageData.contentVariables = JSON.stringify(contentVariables);
      } else {
        messageData.body = message;
      }

      const result = await this.client.messages.create(messageData);

      logger.info(`WhatsApp message sent: ${result.sid}`);
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };

    } catch (error) {
      logger.error('WhatsApp message error:', error);
      throw new Error(`WhatsApp message failed: ${error.message}`);
    }
  }

  async sendWhatsAppTemplate(to, templateName, contentVariables) {
    try {
      if (!this.client) {
        logger.warn('Twilio client not initialized. Skipping WhatsApp template message.');
        return {
          success: false,
          message: 'Twilio not configured',
          status: 'skipped'
        };
      }

      const result = await this.client.messages.create({
        contentSid: this.contentSid,
        contentVariables: JSON.stringify(contentVariables),
        from: this.whatsappNumber,
        to: `whatsapp:${to}`
      });

      logger.info(`WhatsApp template message sent: ${result.sid}`);
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };

    } catch (error) {
      logger.error('WhatsApp template message error:', error);
      throw new Error(`WhatsApp template message failed: ${error.message}`);
    }
  }

  async sendSMS(to, message) {
    try {
      if (!this.client) {
        logger.warn('Twilio client not initialized. Skipping SMS.');
        return {
          success: false,
          message: 'Twilio not configured',
          status: 'skipped'
        };
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      logger.info(`SMS sent: ${result.sid}`);
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };

    } catch (error) {
      logger.error('SMS error:', error);
      throw new Error(`SMS failed: ${error.message}`);
    }
  }

  // Booking-related notifications
  async sendBookingConfirmation(booking) {
    const message = `✅ *MediPod Booking Confirmed*

Booking ID: ${booking.id}
🏥 Service: ${booking.service_type}
📍 Location: ${booking.location}
🕒 Time: ${booking.time_slot}
💰 Service Fee: KES ${booking.service_fee}
🚐 ETA: ${booking.eta_minutes} minutes

Your MediPod team will arrive shortly! 🩺✨

Need to make changes? Reply "RESCHEDULE" or "CANCEL"`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Booking Confirmation'
    });
  }

  async sendBookingReminder(booking, hoursBefore = 1) {
    const message = `⏰ *MediPod Reminder*

Your appointment is in ${hoursBefore} hour(s):

🏥 Service: ${booking.service_type}
📍 Location: ${booking.location}
🕒 Time: ${booking.time_slot}

Please ensure you're available at the specified location.

Need to reschedule? Reply "RESCHEDULE"`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Appointment Reminder'
    });
  }

  async sendVehicleEnRoute(booking, eta) {
    const message = `🚐 *MediPod Van En Route*

Your MediPod team is on the way!

📍 Location: ${booking.location}
🕒 ETA: ${eta} minutes
🏥 Service: ${booking.service_type}

Please ensure someone is available to receive the medical team.`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Vehicle En Route'
    });
  }

  async sendServiceCompletion(booking) {
    const message = `✅ *Service Completed*

Thank you for choosing MediPod!

🏥 Service: ${booking.service_type}
💰 Total Paid: KES ${booking.total_fee}

How was your experience? Reply with your feedback.

Need a follow-up? Reply "FOLLOW-UP"`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Service Completed'
    });
  }

  async sendCancellationConfirmation(booking) {
    const message = `❌ *Booking Cancelled*

Your booking has been cancelled:

🏥 Service: ${booking.service_type}
📍 Location: ${booking.location}
🕒 Time: ${booking.time_slot}

Need to book again? Reply "BOOK"`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Booking Cancelled'
    });
  }

  async sendRescheduleConfirmation(booking, newTime) {
    const message = `🔄 *Booking Rescheduled*

Your appointment has been rescheduled:

🏥 Service: ${booking.service_type}
📍 Location: ${booking.location}
🕒 New Time: ${newTime}

We'll send you a reminder before your new appointment.`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Booking Rescheduled'
    });
  }

  // Payment-related notifications
  async sendPaymentConfirmation(payment) {
    const message = `💰 *Payment Confirmed*

Amount: KES ${payment.amount}
Method: ${payment.method.toUpperCase()}
Reference: ${payment.reference}

Thank you for your payment!`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: payment.phone,
      message: message,
      title: 'Payment Confirmed'
    });
  }

  async sendPaymentReminder(booking) {
    const message = `⏰ *Payment Reminder*

Please complete your payment to confirm your booking:

💰 Amount: KES ${booking.logistics_fee}
🏥 Service: ${booking.service_type}
📍 Location: ${booking.location}

Reply "PAY" to complete payment.`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: booking.phone,
      message: message,
      title: 'Payment Reminder'
    });
  }

  // Health-related notifications
  async sendMedicationReminder(userPhone, medication, time) {
    const message = `💊 *Medication Reminder*

Time to take your medication:
💊 ${medication}
🕒 ${time}

Stay healthy! 💪`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: userPhone,
      message: message,
      title: 'Medication Reminder'
    });
  }

  async sendFollowUpReminder(userPhone, daysSinceVisit) {
    const message = `🩺 *Follow-up Reminder*

It's been ${daysSinceVisit} days since your last visit.

How are you feeling? Would you like to:
1️⃣ Book a follow-up checkup
2️⃣ Get medication refill
3️⃣ Talk to a doctor

Reply with your choice.`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: userPhone,
      message: message,
      title: 'Follow-up Reminder'
    });
  }

  async sendHealthTip(userPhone, tip) {
    const message = `💡 *Health Tip*

${tip}

Stay healthy with MediPod! 🩺✨`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: userPhone,
      message: message,
      title: 'Health Tip'
    });
  }

  // Promotional notifications
  async sendSpecialOffer(userPhone, offer) {
    const message = `🎁 *Special Offer*

${offer.title}

${offer.description}

💰 ${offer.discount}
⏰ Valid until: ${offer.validUntil}

Reply "CLAIM" to book with this offer!`;

    return await this.sendNotification({
      type: 'whatsapp',
      phone: userPhone,
      message: message,
      title: 'Special Offer'
    });
  }

  // Emergency notifications
  async sendEmergencyAlert(userPhone, message) {
    return await this.sendNotification({
      type: 'both', // Send both WhatsApp and SMS for emergencies
      phone: userPhone,
      message: `🚨 EMERGENCY: ${message}`,
      title: 'Emergency Alert',
      priority: 'high'
    });
  }

  // Database operations
  async storeNotification(notificationData) {
    try {
      const { type, phone, message, title, priority } = notificationData;
      
      const result = await query(`
        INSERT INTO notifications (type, phone, title, message, status, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING id
      `, [type, phone, title, message, 'pending']);

      return result.rows[0].id;

    } catch (error) {
      logger.error('Error storing notification:', error);
      throw error;
    }
  }

  async updateNotificationStatus(notificationId, status) {
    try {
      await query(`
        UPDATE notifications 
        SET status = $1, sent_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
        WHERE id = $2
      `, [status, notificationId]);

    } catch (error) {
      logger.error('Error updating notification status:', error);
    }
  }

  async getNotificationStats() {
    try {
      const result = await query(`
        SELECT 
          type,
          status,
          COUNT(*) as count
        FROM notifications 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY type, status
      `);

      const stats = {
        total: 0,
        byType: {},
        byStatus: {}
      };

      result.rows.forEach(row => {
        stats.total += parseInt(row.count);
        
        if (!stats.byType[row.type]) {
          stats.byType[row.type] = {};
        }
        stats.byType[row.type][row.status] = parseInt(row.count);
        
        if (!stats.byStatus[row.status]) {
          stats.byStatus[row.status] = 0;
        }
        stats.byStatus[row.status] += parseInt(row.count);
      });

      return stats;

    } catch (error) {
      logger.error('Error getting notification stats:', error);
      throw error;
    }
  }

  // Bulk notifications
  async sendBulkNotification(phones, message, type = 'whatsapp') {
    const results = [];
    
    for (const phone of phones) {
      try {
        const result = await this.sendNotification({
          type,
          phone,
          message,
          title: 'Bulk Notification'
        });
        results.push({ phone, success: true, result });
      } catch (error) {
        results.push({ phone, success: false, error: error.message });
      }
    }

    return results;
  }
}

// Singleton instance
const notificationService = new NotificationService();

// Export functions for backward compatibility
async function sendNotification(notificationData) {
  return notificationService.sendNotification(notificationData);
}

module.exports = {
  NotificationService,
  notificationService,
  sendNotification
}; 