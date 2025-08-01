const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { redisClient } = require('./redis');

class PaymentService {
  constructor() {
    this.mpesaConfig = {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      businessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE,
      passkey: process.env.MPESA_PASSKEY,
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox'
    };
    
    this.baseUrl = this.mpesaConfig.environment === 'production' 
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  async processPayment(paymentData) {
    try {
      const { method, amount, phone, description } = paymentData;
      
      logger.info(`Processing ${method} payment: KES ${amount} for ${phone}`);

      switch (method.toLowerCase()) {
        case 'mpesa':
          return await this.processMpesaPayment(amount, phone, description);
        
        case 'nhif':
          return await this.processNHIFPayment(amount, phone, description);
        
        case 'wallet':
          return await this.processWalletPayment(amount, phone, description);
        
        default:
          throw new Error(`Unsupported payment method: ${method}`);
      }
    } catch (error) {
      logger.error('Payment processing error:', error);
      throw error;
    }
  }

  async processMpesaPayment(amount, phone, description) {
    try {
      // Check if M-Pesa credentials are configured
      if (!this.mpesaConfig.consumerKey || !this.mpesaConfig.consumerSecret) {
        logger.warn('M-Pesa credentials not configured. Running in simulation mode.');
        return {
          success: true,
          reference: `SIM-${Date.now()}`,
          message: 'M-Pesa payment simulated (credentials not configured)',
          paymentId: uuidv4()
        };
      }

      // Get access token
      const accessToken = await this.getMpesaAccessToken();
      
      // Generate timestamp
      const timestamp = this.generateTimestamp();
      const password = this.generateMpesaPassword(timestamp);
      
      // Prepare request data
      const requestData = {
        BusinessShortCode: this.mpesaConfig.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: phone,
        PartyB: this.mpesaConfig.businessShortCode,
        PhoneNumber: phone,
        CallBackURL: `${process.env.BASE_URL}/api/payment/mpesa/callback`,
        AccountReference: 'MediPod Africa',
        TransactionDesc: description || 'MediPod Logistics Fee'
      };

      // Make STK Push request
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ResponseCode === '0') {
        const paymentRecord = {
          id: uuidv4(),
          method: 'mpesa',
          amount: amount,
          phone: phone,
          description: description,
          reference: response.data.CheckoutRequestID,
          status: 'pending',
          timestamp: new Date().toISOString(),
          mpesaResponse: response.data
        };

        // Store payment record
        await this.storePaymentRecord(paymentRecord);
        
        logger.info(`M-Pesa STK Push sent successfully: ${paymentRecord.reference}`);
        
        return {
          success: true,
          reference: paymentRecord.reference,
          message: 'STK Push sent successfully',
          paymentId: paymentRecord.id
        };
      } else {
        throw new Error(`M-Pesa error: ${response.data.ResponseDescription}`);
      }
    } catch (error) {
      logger.error('M-Pesa payment initiation failed:', error);
      throw new Error(`M-Pesa payment failed: ${error.message}`);
    }
  }

  async processNHIFPayment(amount, phone, description) {
    try {
      // This would integrate with NHIF API
      // For now, simulate NHIF payment processing
      
      const paymentRecord = {
        id: uuidv4(),
        method: 'nhif',
        amount: amount,
        phone: phone,
        description: description,
        reference: `NHIF-${Date.now()}`,
        status: 'pending',
        timestamp: new Date().toISOString()
      };

      // Store payment record
      await this.storePaymentRecord(paymentRecord);
      
      logger.info(`NHIF payment initiated: ${paymentRecord.reference}`);
      
      return {
        success: true,
        reference: paymentRecord.reference,
        message: 'NHIF payment initiated',
        paymentId: paymentRecord.id
      };
    } catch (error) {
      logger.error('NHIF payment error:', error);
      throw new Error(`NHIF payment failed: ${error.message}`);
    }
  }

  async processWalletPayment(amount, phone, description) {
    try {
      // Check wallet balance
      const walletBalance = await this.getWalletBalance(phone);
      
      if (walletBalance < amount) {
        throw new Error(`Insufficient wallet balance. Available: KES ${walletBalance}`);
      }

      // Deduct from wallet
      const newBalance = await this.deductFromWallet(phone, amount);
      
      const paymentRecord = {
        id: uuidv4(),
        method: 'wallet',
        amount: amount,
        phone: phone,
        description: description,
        reference: `WALLET-${Date.now()}`,
        status: 'completed',
        timestamp: new Date().toISOString(),
        walletBalance: newBalance
      };

      // Store payment record
      await this.storePaymentRecord(paymentRecord);
      
      logger.info(`Wallet payment completed: ${paymentRecord.reference}`);
      
      return {
        success: true,
        reference: paymentRecord.reference,
        message: 'Wallet payment successful',
        paymentId: paymentRecord.id,
        newBalance: newBalance
      };
    } catch (error) {
      logger.error('Wallet payment error:', error);
      throw new Error(`Wallet payment failed: ${error.message}`);
    }
  }

  async verifyMpesaPayment(checkoutRequestId) {
    try {
      const accessToken = await this.getMpesaAccessToken();
      
      const requestData = {
        BusinessShortCode: this.mpesaConfig.businessShortCode,
        CheckoutRequestID: checkoutRequestId,
        Password: this.generateMpesaPassword(this.generateTimestamp()),
        Timestamp: this.generateTimestamp()
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.ResponseCode === '0') {
        const resultCode = response.data.ResultCode;
        
        if (resultCode === '0') {
          // Payment successful
          await this.updatePaymentStatus(checkoutRequestId, 'completed', response.data);
          return { success: true, status: 'completed' };
        } else {
          // Payment failed
          await this.updatePaymentStatus(checkoutRequestId, 'failed', response.data);
          return { success: false, status: 'failed', reason: response.data.ResultDesc };
        }
      } else {
        throw new Error(`Verification failed: ${response.data.ResponseDescription}`);
      }
    } catch (error) {
      logger.error('M-Pesa payment verification error:', error);
      throw error;
    }
  }

  async handleMpesaCallback(callbackData) {
    try {
      const { Body: { stkCallback } } = callbackData;
      const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
      
      logger.info(`M-Pesa callback received: ${CheckoutRequestID}, Result: ${ResultCode}`);

      if (ResultCode === '0') {
        // Payment successful
        await this.updatePaymentStatus(CheckoutRequestID, 'completed', stkCallback);
        
        // Get payment details and notify user
        const payment = await this.getPaymentByReference(CheckoutRequestID);
        if (payment) {
          await this.notifyPaymentSuccess(payment);
        }
        
        return { success: true, status: 'completed' };
      } else {
        // Payment failed
        await this.updatePaymentStatus(CheckoutRequestID, 'failed', stkCallback);
        return { success: false, status: 'failed', reason: ResultDesc };
      }
    } catch (error) {
      logger.error('M-Pesa callback handling error:', error);
      throw error;
    }
  }

  // M-Pesa utility methods
  async getMpesaAccessToken() {
    try {
      if (!this.mpesaConfig.consumerKey || !this.mpesaConfig.consumerSecret) {
        throw new Error('M-Pesa credentials not configured');
      }

      const auth = Buffer.from(`${this.mpesaConfig.consumerKey}:${this.mpesaConfig.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Error getting M-Pesa access token:', error);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  generateMpesaPassword(timestamp) {
    const str = `${this.mpesaConfig.businessShortCode}${this.mpesaConfig.passkey}${timestamp}`;
    return Buffer.from(str).toString('base64');
  }

  // Wallet methods
  async getWalletBalance(phone) {
    try {
      const balance = await redisClient.get(`wallet:${phone}`);
      return balance ? parseFloat(balance) : 0;
    } catch (error) {
      logger.error('Error getting wallet balance:', error);
      return 0;
    }
  }

  async deductFromWallet(phone, amount) {
    try {
      const currentBalance = await this.getWalletBalance(phone);
      const newBalance = currentBalance - amount;
      
      if (newBalance < 0) {
        throw new Error('Insufficient balance');
      }
      
      await redisClient.set(`wallet:${phone}`, newBalance.toString());
      return newBalance;
    } catch (error) {
      logger.error('Error deducting from wallet:', error);
      throw error;
    }
  }

  async addToWallet(phone, amount) {
    try {
      const currentBalance = await this.getWalletBalance(phone);
      const newBalance = currentBalance + amount;
      
      await redisClient.set(`wallet:${phone}`, newBalance.toString());
      return newBalance;
    } catch (error) {
      logger.error('Error adding to wallet:', error);
      throw error;
    }
  }

  // Payment record management
  async storePaymentRecord(paymentRecord) {
    try {
      const key = `payment:${paymentRecord.id}`;
      await redisClient.setex(key, 86400, JSON.stringify(paymentRecord)); // 24 hours TTL
      
      // Also store by reference for quick lookup
      const refKey = `payment:ref:${paymentRecord.reference}`;
      await redisClient.setex(refKey, 86400, paymentRecord.id);
      
      logger.info(`Payment record stored: ${paymentRecord.id}`);
    } catch (error) {
      logger.error('Error storing payment record:', error);
      throw error;
    }
  }

  async getPaymentByReference(reference) {
    try {
      const refKey = `payment:ref:${reference}`;
      const paymentId = await redisClient.get(refKey);
      
      if (paymentId) {
        const paymentKey = `payment:${paymentId}`;
        const paymentData = await redisClient.get(paymentKey);
        return paymentData ? JSON.parse(paymentData) : null;
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting payment by reference:', error);
      return null;
    }
  }

  async updatePaymentStatus(reference, status, additionalData = {}) {
    try {
      const payment = await this.getPaymentByReference(reference);
      if (payment) {
        payment.status = status;
        payment.updatedAt = new Date().toISOString();
        payment.additionalData = additionalData;
        
        await this.storePaymentRecord(payment);
        logger.info(`Payment status updated: ${reference} -> ${status}`);
      }
    } catch (error) {
      logger.error('Error updating payment status:', error);
    }
  }

  async notifyPaymentSuccess(payment) {
    try {
      // This would integrate with notification service
      logger.info(`Payment successful notification sent for: ${payment.reference}`);
    } catch (error) {
      logger.error('Error sending payment success notification:', error);
    }
  }

  // Analytics and reporting
  async getPaymentStats() {
    try {
      const pattern = 'payment:*';
      const keys = await redisClient.keys(pattern);
      
      const stats = {
        total: 0,
        completed: 0,
        pending: 0,
        failed: 0,
        byMethod: {},
        totalAmount: 0
      };
      
      for (const key of keys) {
        if (!key.includes(':ref:')) { // Skip reference keys
          const paymentData = await redisClient.get(key);
          if (paymentData) {
            const payment = JSON.parse(paymentData);
            stats.total++;
            stats[payment.status]++;
            stats.totalAmount += payment.amount;
            
            if (!stats.byMethod[payment.method]) {
              stats.byMethod[payment.method] = { count: 0, amount: 0 };
            }
            stats.byMethod[payment.method].count++;
            stats.byMethod[payment.method].amount += payment.amount;
          }
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting payment stats:', error);
      return { total: 0, completed: 0, pending: 0, failed: 0, byMethod: {}, totalAmount: 0 };
    }
  }
}

// Singleton instance
const paymentService = new PaymentService();

// Export functions for backward compatibility
async function processPayment(paymentData) {
  return paymentService.processPayment(paymentData);
}

module.exports = {
  PaymentService,
  paymentService,
  processPayment
};