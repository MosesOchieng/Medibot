const express = require('express');
const router = express.Router();
const { getBotInstance } = require('../services/whatsappBot');
const logger = require('../utils/logger');

// Webhook for incoming WhatsApp messages
router.post('/webhook', async (req, res) => {
  try {
    const bot = getBotInstance();
    if (!bot) {
      logger.error('WhatsApp bot not initialized');
      return res.status(500).send('Bot not initialized');
    }

    await bot.handleIncomingMessage(req, res);
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Webhook verification for WhatsApp Business API
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verify token should match your app's verify token
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'medipod_verify_token';

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  } else {
    res.status(400).send('Bad Request');
  }
});

// Send a test message
router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        error: 'Missing required fields: phone, message'
      });
    }

    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendMessage(phone, message);
    
    res.json({
      success: true,
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      error: 'Failed to send message',
      details: error.message
    });
  }
});

// Get bot status
router.get('/status', (req, res) => {
  const bot = getBotInstance();
  
  res.json({
    status: bot ? 'active' : 'inactive',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get conversation history (for admin purposes)
router.get('/conversations/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { limit = 50 } = req.query;

    // This would typically fetch from a message history database
    // For now, return mock data
    res.json({
      phone,
      conversations: [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          direction: 'incoming',
          message: 'Hi, I need a health checkup',
          status: 'delivered'
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          direction: 'outgoing',
          message: 'Welcome to MediPod! What service do you need?',
          status: 'sent'
        }
      ]
    });

  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({
      error: 'Failed to get conversations'
    });
  }
});

// Send welcome message to a new user
router.post('/welcome/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendWelcomeMessage(phone);
    
    res.json({
      success: true,
      message: 'Welcome message sent'
    });

  } catch (error) {
    logger.error('Welcome message error:', error);
    res.status(500).json({
      error: 'Failed to send welcome message'
    });
  }
});

// Send menu to user
router.post('/menu/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendMainMenu(phone);
    
    res.json({
      success: true,
      message: 'Menu sent'
    });

  } catch (error) {
    logger.error('Menu error:', error);
    res.status(500).json({
      error: 'Failed to send menu'
    });
  }
});

// Send help message
router.post('/help/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendHelpMessage(phone);
    
    res.json({
      success: true,
      message: 'Help message sent'
    });

  } catch (error) {
    logger.error('Help message error:', error);
    res.status(500).json({
      error: 'Failed to send help message'
    });
  }
});

// Send how it works message
router.post('/how-it-works/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendHowItWorks(phone);
    
    res.json({
      success: true,
      message: 'How it works message sent'
    });

  } catch (error) {
    logger.error('How it works error:', error);
    res.status(500).json({
      error: 'Failed to send how it works message'
    });
  }
});

// Send booking summary
router.post('/booking-summary/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { sessionData } = req.body;
    
    if (!sessionData) {
      return res.status(400).json({
        error: 'Missing session data'
      });
    }
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendBookingSummary(phone, sessionData);
    
    res.json({
      success: true,
      message: 'Booking summary sent'
    });

  } catch (error) {
    logger.error('Booking summary error:', error);
    res.status(500).json({
      error: 'Failed to send booking summary'
    });
  }
});

// Send service selection
router.post('/service-selection/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { logistics } = req.body;
    
    if (!logistics) {
      return res.status(400).json({
        error: 'Missing logistics data'
      });
    }
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendServiceSelection(phone, logistics);
    
    res.json({
      success: true,
      message: 'Service selection sent'
    });

  } catch (error) {
    logger.error('Service selection error:', error);
    res.status(500).json({
      error: 'Failed to send service selection'
    });
  }
});

// Send time selection
router.post('/time-selection/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendTimeSelection(phone);
    
    res.json({
      success: true,
      message: 'Time selection sent'
    });

  } catch (error) {
    logger.error('Time selection error:', error);
    res.status(500).json({
      error: 'Failed to send time selection'
    });
  }
});

// Send payment method selection
router.post('/payment-method/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { sessionData } = req.body;
    
    if (!sessionData) {
      return res.status(400).json({
        error: 'Missing session data'
      });
    }
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendPaymentMethod(phone, sessionData);
    
    res.json({
      success: true,
      message: 'Payment method selection sent'
    });

  } catch (error) {
    logger.error('Payment method error:', error);
    res.status(500).json({
      error: 'Failed to send payment method selection'
    });
  }
});

// Send booking confirmation
router.post('/booking-confirmation/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { booking } = req.body;
    
    if (!booking) {
      return res.status(400).json({
        error: 'Missing booking data'
      });
    }
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendBookingConfirmation(phone, booking);
    
    res.json({
      success: true,
      message: 'Booking confirmation sent'
    });

  } catch (error) {
    logger.error('Booking confirmation error:', error);
    res.status(500).json({
      error: 'Failed to send booking confirmation'
    });
  }
});

// Send prediagnosis request
router.post('/prediagnosis/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.requestPrediagnosis(phone);
    
    res.json({
      success: true,
      message: 'Prediagnosis request sent'
    });

  } catch (error) {
    logger.error('Prediagnosis error:', error);
    res.status(500).json({
      error: 'Failed to send prediagnosis request'
    });
  }
});

// Send user bookings
router.post('/user-bookings/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.showUserBookings(phone);
    
    res.json({
      success: true,
      message: 'User bookings sent'
    });

  } catch (error) {
    logger.error('User bookings error:', error);
    res.status(500).json({
      error: 'Failed to send user bookings'
    });
  }
});

// Send cancellation options
router.post('/cancellation-options/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.showCancellationOptions(phone);
    
    res.json({
      success: true,
      message: 'Cancellation options sent'
    });

  } catch (error) {
    logger.error('Cancellation options error:', error);
    res.status(500).json({
      error: 'Failed to send cancellation options'
    });
  }
});

// Send payment reminder
router.post('/payment-reminder/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { sessionData } = req.body;
    
    if (!sessionData) {
      return res.status(400).json({
        error: 'Missing session data'
      });
    }
    
    const bot = getBotInstance();
    if (!bot) {
      return res.status(500).json({
        error: 'Bot not initialized'
      });
    }

    await bot.sendPaymentReminder(phone, sessionData);
    
    res.json({
      success: true,
      message: 'Payment reminder sent'
    });

  } catch (error) {
    logger.error('Payment reminder error:', error);
    res.status(500).json({
      error: 'Failed to send payment reminder'
    });
  }
});

module.exports = router; 