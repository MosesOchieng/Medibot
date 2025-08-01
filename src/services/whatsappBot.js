const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Groq = require('groq-sdk');
const logger = require('../utils/logger');
const { redisClient } = require('./redis');
const { getUserSession, updateUserSession } = require('../services/sessionManager');
const { calculateLogistics } = require('../services/logistics');
const { processPayment } = require('../services/payment');
const { createBooking } = require('../services/booking');
const { sendNotification } = require('../services/notification');

class WhatsAppBot {
  constructor() {
    // Initialize Groq AI
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

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
      console.warn('⚠️  Twilio credentials not provided. WhatsApp bot will run in simulation mode.');
    }
    
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.contentSid = process.env.TWILIO_CONTENT_SID;
    
    // Bot states with advanced features
    this.STATES = {
      WELCOME: 'WELCOME',
      MAIN_MENU: 'MAIN_MENU',
      LOCATION_CAPTURE: 'LOCATION_CAPTURE',
      SERVICE_SELECTION: 'SERVICE_SELECTION',
      TIME_SELECTION: 'TIME_SELECTION',
      PAYMENT_METHOD: 'PAYMENT_METHOD',
      PAYMENT_CONFIRMATION: 'PAYMENT_CONFIRMATION',
      PREDIAGNOSIS: 'PREDIAGNOSIS',
      BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
      CANCELLATION: 'CANCELLATION',
      RESCHEDULE: 'RESCHEDULE',
      RESCHEDULE_TIME: 'RESCHEDULE_TIME',
      SUPPORT: 'SUPPORT',
      VOICE_PROCESSING: 'VOICE_PROCESSING',
      AI_RECOMMENDATIONS: 'AI_RECOMMENDATIONS',
      NOTIFICATIONS: 'NOTIFICATIONS',
      LOYALTY_PROGRAM: 'LOYALTY_PROGRAM',
      VAN_TRACKING: 'VAN_TRACKING',
      BUNDLE_RECOMMENDATIONS: 'BUNDLE_RECOMMENDATIONS',
      REFERRAL_SYSTEM: 'REFERRAL_SYSTEM'
    };

    // Service types with emojis
    this.SERVICES = {
      '1': { name: '🩸 Blood Pressure / Diabetes Check', price: 500, duration: 30, category: 'monitoring' },
      '2': { name: "🧬 Women's Health", price: 800, duration: 45, category: 'specialized' },
      '3': { name: '🧒🏽 Child Check-Up', price: 600, duration: 30, category: 'pediatric' },
      '4': { name: '🧠 Mental Health', price: 1000, duration: 60, category: 'specialized' },
      '5': { name: '🩺 General Consultation', price: 400, duration: 25, category: 'general' },
      '6': { name: '❓ Other (we\'ll ask more)', price: 500, duration: 30, category: 'general' }
    };

    // Service bundles
    this.SERVICE_BUNDLES = {
      'diabetes_care': {
        name: '🩸 Complete Diabetes Care Package',
        services: ['Blood Pressure / Diabetes Check', 'General Consultation'],
        discount: 20,
        description: 'Comprehensive diabetes monitoring and consultation'
      },
      'women_health': {
        name: "🧬 Women's Health Plus",
        services: ["Women's Health", 'General Consultation'],
        discount: 15,
        description: 'Complete women health screening and consultation'
      },
      'family_care': {
        name: '👨‍👩‍👧‍👦 Family Health Package',
        services: ['Child Check-Up', 'General Consultation'],
        discount: 25,
        description: 'Family health checkup package'
      }
    };

    // Time slots with emojis
    this.TIME_SLOTS = {
      '1': { name: '🕒 Morning (9–11 AM)', start: '09:00', end: '11:00' },
      '2': { name: '🌤 Midday (11 AM–1 PM)', start: '11:00', end: '13:00' },
      '3': { name: '☀️ Afternoon (2–4 PM)', start: '14:00', end: '16:00' }
    };

    // Zone-based pricing
    this.ZONES = {
      'A': { name: 'Zone A', fee: 200, eta: '15–30 mins', areas: 'Westlands, Kileleshwa' },
      'B': { name: 'Zone B', fee: 300, eta: '30–45 mins', areas: 'South B, Hurlingham, Parklands' },
      'C': { name: 'Zone C', fee: 400, eta: '45–60 mins', areas: 'Ruaka, Rongai, Embakasi' },
      'D': { name: 'Zone D', fee: 500, eta: '1–2 hrs', areas: 'Kitengela, Juja, Limuru' },
      'E': { name: 'Zone E', fee: 600, eta: '+2 hrs', areas: 'Thika, Ngong, Athi River' }
    };

    // Health tips by condition
    this.HEALTH_TIPS = {
      'UTI': [
        '💧 Drink 8-10 glasses of water daily',
        '🚫 Avoid caffeine and alcohol',
        '🧼 Maintain good hygiene practices',
        '🍓 Eat cranberries or take supplements'
      ],
      'diabetes': [
        '📊 Monitor blood sugar regularly',
        '🥗 Follow a balanced diet plan',
        '🏃‍♂️ Exercise for 30 minutes daily',
        '💊 Take medications as prescribed'
      ],
      'hypertension': [
        '🧂 Reduce salt intake',
        '🏃‍♀️ Exercise regularly',
        '😴 Get 7-8 hours of sleep',
        '🧘‍♀️ Practice stress management'
      ],
      'mental_health': [
        '🧘‍♀️ Practice mindfulness daily',
        '👥 Stay connected with loved ones',
        '🌞 Get regular sunlight exposure',
        '📞 Reach out for professional help'
      ]
    };

    // Loyalty points storage (in production, use Redis)
    this.loyaltyPoints = new Map();
    this.referralCodes = new Map();
    this.activeBookings = new Map();
    this.vanTracking = new Map();
    this.notificationQueue = new Map();
    this.scheduledNotifications = new Map();
  }

  // WhatsApp-style bubble responses
  createThinkingBubble() {
    const image = this.getRandomImage();
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

🤔 *MediBot is thinking...*
⏳ Processing your request...
🧠 Analyzing with AI...
    </Message>
</Response>`;
  }

  createProcessingBubble(action) {
    const actions = {
      'payment': '💳 Processing payment...',
      'booking': '📅 Confirming booking...',
      'location': '📍 Calculating logistics...',
      'voice': '🎤 Transcribing voice note...',
      'ai': '🧠 AI analyzing symptoms...',
      'tracking': '🚐 Updating van location...'
    };
    
    const message = actions[action] || '⏳ Processing...';
    const image = this.getRandomImage();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

${message}
⏳ Please wait...
    </Message>
</Response>`;
  }

  createSuccessBubble(message, type = 'success') {
    const icons = {
      'success': '✅',
      'payment': '💳',
      'booking': '📅',
      'health': '🏥',
      'loyalty': '🏆',
      'tracking': '🚐'
    };
    
    const icon = icons[type] || '✅';
    const image = this.getRandomImage();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

${icon} ${message}
    </Message>
</Response>`;
  }

  createErrorBubble(message) {
    const image = this.getRandomImage();
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

❌ *Oops! Something went wrong*
${message}

Please try again or contact support.
    </Message>
</Response>`;
  }

  createInfoBubble(message, title = 'ℹ️ Information') {
    const image = this.getRandomImage();
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

${title}
${message}
    </Message>
</Response>`;
  }

  async handleIncomingMessage(req, res) {
    try {
      const { Body, From, MediaUrl0, NumMedia } = req.body;
      const userPhone = From.replace('whatsapp:', '');
      
      logger.info(`📱 Incoming message from ${userPhone}: ${Body}`);

      // Get or create user session
      let session = await getUserSession(userPhone);
      if (!session) {
        session = {
          userId: uuidv4(),
          phone: userPhone,
          state: this.STATES.WELCOME,
          data: {},
          createdAt: new Date()
        };
      }

      // Handle different message types
      if (NumMedia > 0 && MediaUrl0) {
        await this.handleMediaMessage(userPhone, MediaUrl0, session);
      } else if (Body) {
        await this.handleTextMessage(userPhone, Body, session);
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('Error handling incoming message:', error);
      res.status(500).send('Error');
    }
  }

  async handleTextMessage(userPhone, message, session) {
    try {
      // Check if it's a health question (not a menu selection)
      if (message.length > 20 && !/^[1-9]$/.test(message.trim())) {
        // Send thinking bubble for health questions
        await this.sendMessage(userPhone, this.createThinkingBubble());
        
        // Process with AI in background
        setTimeout(async () => {
          try {
            const healthData = await this.getUserHealthData(userPhone);
            const aiResponse = await this.getPersonalizedHealthAdvice(message, healthData);
            
            if (aiResponse) {
              const intelligentResponse = `${aiResponse}

*Quick Actions:*
1️⃣ Book a Health Visit
2️⃣ View My Bookings  
3️⃣ Reschedule or Cancel Visit
4️⃣ Call for Help
5️⃣ 🔔 Smart Notifications
6️⃣ 🏆 Loyalty Program
7️⃣ 🚐 Van Tracking
8️⃣ 📦 Service Bundles
9️⃣ 👥 Refer Friends`;
              
              await this.sendVoiceResponse(userPhone, intelligentResponse);
            }
          } catch (error) {
            logger.error('AI processing error:', error);
            await this.sendMessage(userPhone, this.createErrorBubble('AI processing failed. Please try again.'));
          }
        }, 2000);
        
      return;
    }

      // Handle regular bot state processing
    switch (session.state) {
      case this.STATES.WELCOME:
          await this.handleWelcomeState(userPhone, message, session);
        break;
      case this.STATES.MAIN_MENU:
          await this.handleMainMenu(userPhone, message, session);
        break;
      case this.STATES.LOCATION_CAPTURE:
          await this.handleLocationCapture(userPhone, message, session);
        break;
      case this.STATES.SERVICE_SELECTION:
          await this.handleServiceSelection(userPhone, message, session);
        break;
      case this.STATES.TIME_SELECTION:
          await this.handleTimeSelection(userPhone, message, session);
        break;
      case this.STATES.PAYMENT_METHOD:
          await this.handlePaymentMethod(userPhone, message, session);
        break;
      case this.STATES.PAYMENT_CONFIRMATION:
          await this.handlePaymentConfirmation(userPhone, message, session);
        break;
      case this.STATES.PREDIAGNOSIS:
          await this.handlePrediagnosis(userPhone, message, session);
        break;
        case this.STATES.VOICE_PROCESSING:
          await this.handleVoiceProcessing(userPhone, message, session);
          break;
        case this.STATES.AI_RECOMMENDATIONS:
          await this.handleAIRecommendations(userPhone, message, session);
          break;
        case this.STATES.NOTIFICATIONS:
          await this.handleNotifications(userPhone, message, session);
          break;
        case this.STATES.LOYALTY_PROGRAM:
          await this.handleLoyaltyProgram(userPhone, message, session);
          break;
        case this.STATES.VAN_TRACKING:
          await this.handleVanTracking(userPhone, message, session);
          break;
        case this.STATES.BUNDLE_RECOMMENDATIONS:
          await this.handleBundleRecommendations(userPhone, message, session);
          break;
        case this.STATES.REFERRAL_SYSTEM:
          await this.handleReferralSystem(userPhone, message, session);
          break;
      case this.STATES.RESCHEDULE:
        await this.handleRescheduleTimeSelection(userPhone, message, session);
        break;
      case this.STATES.SUPPORT:
        await this.handleSupportRequest(userPhone);
        break;
      default:
          await this.handleWelcomeState(userPhone, message, session);
      }
    } catch (error) {
      logger.error('Error handling text message:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Error processing message. Please try again.'));
    }
  }

  async handleWelcomeState(userPhone, message, session) {
    if (message.includes('1') || message.includes('book') || message.includes('visit')) {
      session.state = this.STATES.LOCATION_CAPTURE;
      await updateUserSession(userPhone, session);
      await this.requestLocation(userPhone);
    } else if (message.includes('2') || message.includes('voice') || message.includes('🎤')) {
      await this.handleVoiceNote(userPhone, session);
    } else if (message.includes('3') || message.includes('how') || message.includes('works')) {
      await this.sendHowItWorks(userPhone);
    } else {
      await this.sendWelcomeMessage(userPhone);
    }
  }

  async handleMainMenu(userPhone, message, session) {
    try {
      const userInput = message.toLowerCase();
      
      if (userInput === '1' || userInput.includes('book') || userInput.includes('health visit')) {
        session.state = this.STATES.LOCATION_CAPTURE;
        await updateUserSession(userPhone, session);
        await this.sendMainMenu(userPhone);
      } else if (userInput === '2' || userInput.includes('view') || userInput.includes('bookings')) {
        await this.handleViewBookings(userPhone, message, session);
      } else if (userInput === '3' || userInput.includes('reschedule') || userInput.includes('cancel')) {
        await this.handleRescheduleCancel(userPhone, message, session);
      } else if (userInput === '4' || userInput.includes('help') || userInput.includes('call')) {
        await this.handleSupportRequest(userPhone);
      } else if (userInput === '5' || userInput.includes('notification')) {
        await this.handleNotifications(userPhone, message, session);
      } else if (userInput === '6' || userInput.includes('loyalty')) {
        await this.handleLoyaltyProgram(userPhone, message, session);
      } else if (userInput === '7' || userInput.includes('tracking') || userInput.includes('van')) {
        await this.handleVanTracking(userPhone, message, session);
      } else if (userInput === '8' || userInput.includes('bundle')) {
        await this.handleBundleRecommendations(userPhone, message, session);
      } else if (userInput === '9' || userInput.includes('refer')) {
        await this.handleReferralSystem(userPhone, message, session);
      } else if (userInput.includes('voice') || userInput.includes('record')) {
        await this.handleVoiceNote(userPhone, session);
      } else if (userInput.includes('how') || userInput.includes('works')) {
        await this.sendHowItWorks(userPhone);
      } else {
        // Use AI for intelligent responses to unexpected inputs
        const healthData = await this.getUserHealthData(userPhone);
        const aiResponse = await this.getPersonalizedHealthAdvice(message, healthData);
        
        if (aiResponse) {
          const intelligentResponse = `${aiResponse}

*Quick Actions:*
1️⃣ Book a Health Visit
2️⃣ View My Bookings  
3️⃣ Reschedule or Cancel Visit
4️⃣ Call for Help
5️⃣ 🔔 Smart Notifications
6️⃣ 🏆 Loyalty Program
7️⃣ 🚐 Van Tracking
8️⃣ 📦 Service Bundles
9️⃣ 👥 Refer Friends`;
          
          await this.sendMessageWithImage(userPhone, intelligentResponse, this.getRandomImage());
        } else {
          const defaultResponse = `Please reply with:
*1* - Book a Health Visit
*2* - View My Bookings  
*3* - Reschedule or Cancel Visit
*4* - Call for Help
*5* - 🔔 Smart Notifications
*6* - 🏆 Loyalty Program
*7* - 🚐 Van Tracking
*8* - 📦 Service Bundles
*9* - 👥 Refer Friends`;
          
          await this.sendMessage(userPhone, defaultResponse);
        }
      }
    } catch (error) {
      logger.error('Error handling main menu:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error processing your request. Please try again.'));
    }
  }

  async handleLocationCapture(userPhone, message, session) {
    // Store location in session
    session.data.location = message;
    const zone = this.calculateZone(message);
    session.data.zone = zone;
    
    await updateUserSession(userPhone, session);
    
    const serviceMessage = `📍 *Location Confirmed!*

✅ Location: ${message}
🗺️ Zone: ${this.ZONES[zone].name}
💰 Logistics Fee: KES ${this.ZONES[zone].fee}
⏰ ETA: ${this.ZONES[zone].eta}

🩺 *Step 2: Choose Service*

What service do you need today?

1️⃣ 🩸 Blood Pressure / Diabetes Check  
2️⃣ 🧬 Women's Health  
3️⃣ 🧒🏽 Child Check-Up  
4️⃣ 🧠 Mental Health  
5️⃣ 🩺 General Consultation  
6️⃣ ❓ Other (we'll ask more)

Reply with the number (1-6) of your preferred service.`;
    
    await this.sendMessage(userPhone, this.createSuccessBubble(serviceMessage, 'location'));
  }

  async handleServiceSelection(userPhone, message, session) {
    const serviceNumber = message.trim();
    const service = this.SERVICES[serviceNumber];
    
    if (!service) {
      await this.sendMessage(userPhone, this.createErrorBubble('Please select a valid service (1-6).'));
      return;
    }
    
    session.data.service = service;
    
    // Update user health data with service preference
    const healthData = await this.getUserHealthData(userPhone);
    if (!healthData.preferredServices.includes(service.category)) {
      healthData.preferredServices.push(service.category);
      // In production, save to database
    }
    
    await updateUserSession(userPhone, session);
    
    const timeMessage = `🩺 *Service Selected!*

✅ Service: ${session.data.service.name}
💰 Price: KES ${session.data.service.price}
⏱️ Duration: ${session.data.service.duration} minutes

🕒 *Step 3: Pick a Time Slot*

What time works best for you?

1️⃣ 🕒 Morning (9–11 AM)  
2️⃣ 🌤 Midday (11 AM–1 PM)  
3️⃣ ☀️ Afternoon (2–4 PM)

Reply with the number (1-3) of your preferred time slot.`;
    
    await this.sendMessage(userPhone, this.createSuccessBubble(timeMessage, 'health'));
  }

  async handleTimeSelection(userPhone, message, session) {
    const timeSlot = this.TIME_SLOTS[message];
    if (timeSlot) {
      session.data.selectedTimeSlot = timeSlot;
      session.state = this.STATES.PAYMENT_METHOD;
      await updateUserSession(userPhone, session);
      await this.sendPaymentMethod(userPhone, session.data);
    } else {
      await this.sendTimeSelection(userPhone);
    }
  }

  async handlePaymentMethod(userPhone, message, session) {
    if (message.includes('1') || message.includes('mpesa')) {
      session.data.paymentMethod = 'mpesa';
      session.state = this.STATES.PAYMENT_CONFIRMATION;
      await updateUserSession(userPhone, session);
      await this.initiateMpesaPayment(userPhone, session.data);
    } else if (message.includes('2') || message.includes('nhif')) {
      session.data.paymentMethod = 'nhif';
      session.state = this.STATES.PAYMENT_CONFIRMATION;
      await updateUserSession(userPhone, session);
      await this.requestNHIFCard(userPhone);
    } else if (message.includes('3') || message.includes('wallet')) {
      session.data.paymentMethod = 'wallet';
      session.state = this.STATES.PAYMENT_CONFIRMATION;
      await updateUserSession(userPhone, session);
      await this.processWalletPayment(userPhone, session.data);
    } else {
      await this.sendPaymentMethod(userPhone, session.data);
    }
  }

  async handlePaymentConfirmation(userPhone, message, session) {
    const paymentNumber = message.trim();
    let paymentMethod = '';
    
    switch (paymentNumber) {
      case '1':
        paymentMethod = '📲 M-PESA (STK Push sent)';
        break;
      case '2':
        paymentMethod = '🧾 NHIF (NHIF Card No.)';
        break;
      case '3':
        paymentMethod = '💼 MediPod Wallet';
        break;
      default:
        await this.sendMessage(userPhone, this.createErrorBubble('Please select a valid payment method (1-3).'));
        return;
    }
    
    session.data.paymentMethod = paymentMethod;
    
    // Update user health data with payment preference
    const healthData = await this.getUserHealthData(userPhone);
    if (!healthData.paymentMethods.includes(paymentMethod)) {
      healthData.paymentMethods.push(paymentMethod);
      // In production, save to database
    }
    
      await updateUserSession(userPhone, session);
    
    const confirmationMessage = `✅ *Payment Method Confirmed!*

💳 Method: ${session.data.paymentMethod}

*Next Steps:*
1️⃣ You'll receive an M-Pesa prompt (if M-Pesa selected)
2️⃣ Our logistics team will contact you with ETA
3️⃣ Medical team will arrive at scheduled time

📝 *Want to share symptoms so we can come prepared?*

Please send:
📛 Full Name  
💍 Marital Status  
🤧 Symptoms You're Experiencing  
📅 How long they've lasted  
💊 Are you on any medication?  
🤧 Do you have allergies?

🎤 Or record a voice note if it's easier.

Reply *SKIP* to skip prediagnosis.`;
    
    await this.sendMessage(userPhone, this.createSuccessBubble(confirmationMessage, 'payment'));
  }

  async handlePrediagnosis(userPhone, message, session) {
    if (message.toLowerCase() === 'skip') {
      await this.completeBooking(userPhone, session);
    } else {
      // Store prediagnosis info and extract conditions
      session.data.prediagnosis = message;
      
      // Extract potential conditions from symptoms
      const conditions = [];
      const symptoms = message.toLowerCase();
      if (symptoms.includes('uti') || symptoms.includes('urinary')) conditions.push('UTI');
      if (symptoms.includes('diabetes') || symptoms.includes('blood sugar')) conditions.push('diabetes');
      if (symptoms.includes('ulcer') || symptoms.includes('stomach')) conditions.push('ulcer');
      if (symptoms.includes('h pylori')) conditions.push('H. Pylori');
      
      // Update user health data
      const healthData = await this.getUserHealthData(userPhone);
      conditions.forEach(condition => {
        if (!healthData.conditions.includes(condition)) {
          healthData.conditions.push(condition);
        }
      });
      
      // Extract name if provided
      const nameMatch = message.match(/(?:name|i'm|i am|call me)\s+(?:is\s+)?([A-Za-z]+)/i);
      if (nameMatch) {
        healthData.name = nameMatch[1];
      }
      
      // In production, save to database
      
      await this.completeBooking(userPhone, session);
    }
  }

  async completeBooking(userPhone, session) {
    // Update user health data with booking
    const healthData = await this.getUserHealthData(userPhone);
    healthData.visitCount += 1;
    healthData.lastVisit = new Date();
    const bookingId = `MPA-${Date.now().toString().slice(-4)}`;
    healthData.bookings.push({
      id: bookingId,
      service: session.data.service.name,
      date: new Date(),
      status: 'confirmed'
    });
    // In production, save to database
    
    // Add loyalty points
    const pointsEarned = this.addLoyaltyPoints(userPhone, 50, 'Booking completed');
    const userLoyalty = this.loyaltyPoints.get(userPhone);
    
    // Store active booking for van tracking
    this.activeBookings.set(userPhone, {
      id: bookingId,
      service: session.data.service,
      timeSlot: session.data.timeSlot,
      location: session.data.location,
      status: 'confirmed'
    });
    
    // Schedule notifications
    this.scheduleNotification(userPhone, 'reminder', `Reminder: Your MediPod appointment is in 1 hour. Van will arrive at ${session.data.timeSlot.start}`, 60);
    this.scheduleNotification(userPhone, 'arrival', `Your MediPod van has arrived! Please meet the medical team at your location.`, 120);
    
    const finalMessage = `✅ *Booking Complete!*

Thank you for choosing MediPod Africa! 🏥

*Booking Summary:*
📋 ID: ${bookingId}
🩺 Service: ${session.data.service.name}
🕒 Time: ${session.data.timeSlot.name}
📍 Location: ${session.data.location}
💰 Logistics: KES ${session.data.logisticsFee}
💳 Payment: ${session.data.paymentMethod}

*Loyalty Points Earned:*
⭐ +${pointsEarned} points (Total: ${userLoyalty.points})
🎁 Redeem points for discounts and free services

*What's Next:*
🚐 Medical team will arrive at ${session.data.timeSlot.start}
📞 You'll receive a call 15 minutes before arrival
🏥 Service fee (KES ${session.data.service.price}) payable on arrival

*Advanced Features:*
⏰ Real-time van tracking with GPS
📍 Location pin when van arrives
🔔 Smart notifications and reminders
🔄 Easy reschedule/cancel options
🏆 Loyalty rewards and points

*Quick Actions:*
1️⃣ Track Van (available 30 mins before)
2️⃣ Book another appointment
3️⃣ View loyalty points
4️⃣ Get support

Reply with your choice (1-4).`;
    
    session.state = this.STATES.MAIN_MENU;
    await updateUserSession(userPhone, session);
    await this.sendMessage(userPhone, this.createSuccessBubble(finalMessage, 'booking'));
  }

  // Message sending methods
  async sendWelcomeMessage(userPhone) {
    try {
      // Get personalized recommendations
      const recommendations = await this.getPersonalizedRecommendations(userPhone);
      const healthData = await this.getUserHealthData(userPhone);
      
      // Use external hosted images
      const randomImage = this.getRandomImage();
      
      // First message - Clean introduction with image
      const introMessage = `👋🏾 Hi there! I'm *MediBot* — your advanced AI health assistant from *MediPod Africa*.

🎤 You can record a *voice note* to tell me your issue  
📲 Or use the quick menu below to get started.

🔍 What would you like to do?

1️⃣ Book a Health Visit  
2️⃣ View My Bookings  
3️⃣ Reschedule or Cancel Visit  
4️⃣ Call for Help  
5️⃣ 🔔 Smart Notifications  
6️⃣ 🏆 Loyalty Program  
7️⃣ 🚐 Van Tracking  
8️⃣ 📦 Service Bundles  
9️⃣ 👥 Refer Friends`;

      // Send introduction with image
      if (this.client) {
        await this.sendMessageWithImage(userPhone, introMessage, randomImage);
      } else {
        logger.info(`[SIMULATION] Sending welcome message with image to ${userPhone}: ${introMessage}`);
      }

      // Add personalized recommendations if available (second message)
      if (recommendations.length > 0) {
        let recommendationsMessage = `💡 *Personalized for you:*`;
        recommendations.forEach(rec => {
          recommendationsMessage += `\n${rec.message}`;
        });
        
        recommendationsMessage += `\n\nHow can I help you today? 😊`;
        
        // Send recommendations as second message
        if (this.client) {
          await this.sendMessageWithImage(userPhone, recommendationsMessage, this.getRandomImage());
        } else {
          logger.info(`[SIMULATION] Sending recommendations to ${userPhone}: ${recommendationsMessage}`);
        }
      } else {
        // Send follow-up message if no recommendations
        const followUpMessage = `How can I help you today? 😊`;
        
        if (this.client) {
          await this.sendMessageWithImage(userPhone, followUpMessage, this.getRandomImage());
        } else {
          logger.info(`[SIMULATION] Sending follow-up to ${userPhone}: ${followUpMessage}`);
        }
      }

      // Update session to wait for user response
      await updateUserSession(userPhone, { state: this.STATES.MAIN_MENU });
      
    } catch (error) {
      logger.error('Error sending welcome message:', error);
    }
  }

  async sendMainMenu(userPhone) {
    try {
      const menuMessage = `📍 *Step 1: Share Your Location*

Please share your location 📍  
(You can type the name of your estate, or pin your current location.)

*Example:* "Kilimani, Nairobi" or "Westlands, ABC Street"

*Behind the scenes:* Bot calculates distance from nearest MediPod base + determines your zone for pricing and ETA.`;

      await this.sendMessageWithImage(userPhone, menuMessage, this.getRandomImage());
    } catch (error) {
      logger.error('Error sending main menu:', error);
    }
  }

  async requestLocation(userPhone) {
    const message = `📍 Please share your location

You can:
• Type the name of your estate/area
• Share your current location
• Tell us your nearest landmark

This helps us calculate the logistics fee and ETA.`;

    await this.sendMessage(userPhone, message);
  }

  async sendServiceSelection(userPhone, logistics) {
    try {
      const serviceMessage = `📍 *Location Confirmed!*

✅ Location: ${logistics.location}
🗺️ Zone: ${logistics.zone}
💰 Logistics Fee: KES ${logistics.fee}
⏰ ETA: ${logistics.eta}

🩺 *Step 2: Choose Service*

What service do you need today?

1️⃣ 🩸 Blood Pressure / Diabetes Check  
2️⃣ 🧬 Women's Health  
3️⃣ 🧒🏽 Child Check-Up  
4️⃣ 🧠 Mental Health  
5️⃣ 🩺 General Consultation  
6️⃣ ❓ Other (we'll ask more)

Reply with the number (1-6) of your preferred service.`;

      await this.sendMessageWithImage(userPhone, serviceMessage, this.getRandomImage());
    } catch (error) {
      logger.error('Error sending service selection:', error);
    }
  }

  async sendTimeSelection(userPhone) {
    try {
      const timeMessage = `🩺 *Service Selected!*

🕒 *Step 3: Pick a Time Slot*

What time works best for you?

1️⃣ 🕒 Morning (9–11 AM)  
2️⃣ 🌤 Midday (11 AM–1 PM)  
3️⃣ ☀️ Afternoon (2–4 PM)

Reply with the number (1-3) of your preferred time slot.`;

      await this.sendMessageWithImage(userPhone, timeMessage, this.getRandomImage());
    } catch (error) {
      logger.error('Error sending time selection:', error);
    }
  }

  async sendPaymentMethod(userPhone, sessionData) {
    try {
      const paymentMessage = `🔐 *Choose Payment Method*

1️⃣ 📲 M-PESA (STK Push sent)  
2️⃣ 🧾 NHIF (NHIF Card No.)  
3️⃣ 💼 MediPod Wallet (Your phone = Wallet ID)

Reply with your preferred payment method (1-3).`;

      await this.sendMessageWithImage(userPhone, paymentMessage, this.getRandomImage());
    } catch (error) {
      logger.error('Error sending payment method:', error);
    }
  }

  async sendBookingConfirmation(userPhone, booking) {
    try {
      const confirmationMessage = `✅ *Booking Complete!*

Thank you for choosing MediPod Africa! 🏥

*Booking Summary:*
📋 ID: ${booking.id}
🩺 Service: ${booking.service}
🕒 Time: ${booking.timeSlot}
📍 Location: ${booking.location}
💰 Total: KES ${booking.totalFee}

*What's Next:*
🚐 Medical team will arrive at scheduled time
📞 You'll receive a call 15 minutes before arrival
🏥 Service fee payable on arrival

Reply with *1* to track van or *2* for support.`;

      await this.sendMessageWithImage(userPhone, confirmationMessage, this.getRandomImage());
    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
    }
  }

  async requestPrediagnosis(userPhone) {
    const message = `📝 Want to share a few symptoms so we can come prepared?

Please send:
• Your full name
• Age
• Main symptoms
• How long they've lasted
• Any current medications

🎤 Or record a voice note if it's easier.

Reply "SKIP" if you prefer not to share.`;

    await this.sendMessage(userPhone, message);
  }

  async sendBookingSummary(userPhone, sessionData) {
    const message = `📋 *Booking Summary*

🏥 Service: ${sessionData.selectedService.name}
📍 Location: ${sessionData.location}
🕒 Time: ${sessionData.selectedTimeSlot.name}
💰 Logistics Paid: KES ${sessionData.logistics.fee}
�� ETA: ${sessionData.logistics.eta} minutes

Your MediPod team will arrive shortly! 🩺✨

Need to make changes? Reply "RESCHEDULE" or "CANCEL"`;

    await this.sendMessage(userPhone, message);
  }

  // Utility methods
  async sendMessage(to, body, contentVariables = null) {
    try {
      if (this.client) {
        const messageData = {
          to: `whatsapp:${to}`,
          from: this.fromNumber,
          body: body
        };

        if (contentVariables && this.contentSid) {
          messageData.contentSid = this.contentSid;
          messageData.contentVariables = JSON.stringify(contentVariables);
        }

        const message = await this.client.messages.create(messageData);
        logger.info(`✅ Message sent to ${to}: ${body.substring(0, 50)}...`);
        return message;
      } else {
        logger.info(`📱 [SIMULATION] Message to ${to}: ${body}`);
        return { sid: 'simulated_message' };
      }
    } catch (error) {
      logger.error(`❌ Error sending message to ${to}:`, error);
      throw error;
    }
  }

  async sendMessageWithImage(to, body, imageUrl) {
    try {
      if (this.client) {
        const message = await this.client.messages.create({
          to: `whatsapp:${to}`,
          from: this.fromNumber,
          mediaUrl: [imageUrl],
          body: body
        });
        logger.info(`✅ Message with image sent to ${to}: ${body.substring(0, 50)}...`);
        return message;
      } else {
        logger.info(`📱 [SIMULATION] Message with image to ${to}: ${body} (Image: ${imageUrl})`);
        return { sid: 'simulated_message_with_image' };
      }
    } catch (error) {
      logger.error(`❌ Error sending message with image to ${to}:`, error);
      throw error;
    }
  }

  getRandomImage() {
    // Use external hosted images that work everywhere
    const images = [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop&crop=center',
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop&crop=center'
    ];
    return images[Math.floor(Math.random() * images.length)];
  }

  async handleMediaMessage(userPhone, mediaUrl, session) {
    try {
      logger.info(`📱 Processing media message from ${userPhone}`);
      
      // Send processing bubble immediately
      await this.sendMessage(userPhone, this.createProcessingBubble('voice'));
      
      // Process voice note in background
      setTimeout(async () => {
        try {
          const transcription = await this.transcribeVoiceNote(mediaUrl);
          if (transcription) {
            logger.info('🎤 Voice transcription:', transcription);
            
            // Analyze with AI
            const aiAnalysis = await this.analyzeVoiceNote(transcription);
            logger.info('🧠 AI analysis:', aiAnalysis);
            
            // Create comprehensive response
            const voiceResponse = `🎤 *Voice Note Analysis Complete*

*Transcription:* "${transcription}"

*AI Health Analysis:*
${aiAnalysis || 'Analysis completed. Please book an appointment for professional consultation.'}

*Recommended Actions:*
1️⃣ Book appointment based on symptoms
2️⃣ Get detailed health advice
3️⃣ Schedule follow-up consultation
4️⃣ Back to main menu

Reply with your choice (1-4).`;
            
            // Update session for voice processing
            session.state = this.STATES.VOICE_PROCESSING;
            session.data.transcription = transcription;
            session.data.aiAnalysis = aiAnalysis;
            await updateUserSession(userPhone, session);
            
            // Send voice response
            await this.sendVoiceResponse(userPhone, voiceResponse);
          }
        } catch (error) {
          logger.error('Voice processing error:', error);
          await this.sendMessage(userPhone, this.createErrorBubble('Voice processing failed. Please try again.'));
        }
      }, 3000);
      
    } catch (error) {
      logger.error('Error handling media message:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Error processing media. Please try again.'));
    }
  }

  async handleVoiceNote(userPhone, session) {
    const message = `🎤 Thanks for the voice note! 

I'm processing your message. In the meantime, you can also:

1️⃣ Book a Health Visit  
2️⃣ View My Bookings  
3️⃣ Get Help

What would you like to do?`;

    await this.sendMessage(userPhone, message);
  }

  async handleImage(userPhone, mediaUrl, session) {
    const message = `📸 Thanks for the image! 

I can see you've shared a photo. This could be helpful for our medical team.

Would you like to:
1️⃣ Continue with booking
2️⃣ Add this to your medical record
3️⃣ Get immediate assistance

What would you prefer?`;

    await this.sendMessage(userPhone, message);
  }

  // Payment processing methods
  async initiateMpesaPayment(userPhone, sessionData) {
    try {
      const payment = await processPayment({
        method: 'mpesa',
        amount: sessionData.logistics.fee,
        phone: userPhone,
        description: 'MediPod Logistics Fee'
      });

      const message = `📲 M-PESA STK Push sent to ${userPhone}

Amount: KES ${sessionData.logistics.fee}
Reference: ${payment.reference}

Please check your phone and enter your M-PESA PIN.

Reply "PAID" once you've completed the payment.`;

      await this.sendMessage(userPhone, message);
    } catch (error) {
      logger.error('M-PESA payment initiation failed:', error);
      await this.sendMessage(userPhone, '❌ Payment initiation failed. Please try again or choose another method.');
    }
  }

  async requestNHIFCard(userPhone) {
    const message = `🧾 Please provide your NHIF card number

Format: NHIF-XXXX-XXXX-XXXX

We'll verify your coverage and process the payment.`;

    await this.sendMessage(userPhone, message);
  }

  async processWalletPayment(userPhone, sessionData) {
    try {
      const payment = await processPayment({
        method: 'wallet',
        amount: sessionData.logistics.fee,
        phone: userPhone,
        description: 'MediPod Logistics Fee'
      });

      const message = `💼 Wallet payment processed!

Amount: KES ${sessionData.logistics.fee}
Balance: KES ${payment.newBalance}
Reference: ${payment.reference}

Payment successful! ✅`;

      await this.sendMessage(userPhone, message);
      
      // Auto-confirm payment
      sessionData.paymentConfirmed = true;
      await this.handlePaymentConfirmation(userPhone, 'paid', { data: sessionData });
    } catch (error) {
      logger.error('Wallet payment failed:', error);
      await this.sendMessage(userPhone, '❌ Wallet payment failed. Please try M-PESA or NHIF.');
    }
  }

  // Additional utility methods
  async sendHowItWorks(userPhone) {
    const message = `ℹ️ *How MediPod Works*

🚐 **Mobile Clinic**: We bring healthcare to your doorstep
🩺 **Professional Care**: Licensed doctors and nurses
💊 **Medication**: Prescriptions and delivery included
📱 **Easy Booking**: Just WhatsApp us anytime
💰 **Transparent Pricing**: No hidden costs

Ready to book? Reply "1" or "BOOK"`;

    await this.sendMessage(userPhone, message);
  }

  async showUserBookings(userPhone) {
    // This would fetch from database
    const message = `📋 *Your Recent Bookings*

No active bookings found.

Would you like to:
1️⃣ Book a new visit
2️⃣ View booking history
3️⃣ Get help

Reply with your choice.`;

    await this.sendMessage(userPhone, message);
  }

  async showCancellationOptions(userPhone) {
    const message = `🔄 Cancellation & Rescheduling

1️⃣ Cancel Visit
2️⃣ Reschedule Visit  
3️⃣ Talk to Support
4️⃣ Back to Main Menu

What would you like to do?`;

    await this.sendMessage(userPhone, message);
  }

  async sendHelpMessage(userPhone) {
    const message = `🆘 *Need Help?*

📞 **Call Us**: +254 700 000 000
📧 **Email**: support@medipod.africa
💬 **Live Chat**: Available 24/7

🩺 **Emergency**: If you need immediate medical attention, please call emergency services.

How can we help you today?`;

    await this.sendMessage(userPhone, message);
  }

  async sendPaymentReminder(userPhone, sessionData) {
    const message = `⏰ *Payment Reminder*

Amount: KES ${sessionData.logistics.fee}
Method: ${sessionData.paymentMethod.toUpperCase()}

Please complete your payment to confirm your booking.

Reply "PAID" once payment is complete, or "CANCEL" to cancel.`;

    await this.sendMessage(userPhone, message);
  }

  async sendTemplateMessage(to, templateName, contentVariables) {
    try {
      if (!this.client) {
        logger.warn(`📤 [SIMULATION] Template message would be sent to ${to} using ${templateName}`);
        return;
      }

      const messageData = {
        contentSid: this.contentSid,
        contentVariables: JSON.stringify(contentVariables),
        from: this.fromNumber,
        to: `whatsapp:${to}`
      };

      await this.client.messages.create(messageData);
      logger.info(`📤 Template message sent to ${to} using ${templateName}`);
    } catch (error) {
      logger.error(`Error sending template message to ${to}:`, error);
    }
  }

  // Example usage of ContentSid template (like your curl example)
  async sendBookingTemplate(to, date, time) {
    const contentVariables = {
      "1": date,  // e.g., "12/1"
      "2": time   // e.g., "3pm"
    };
    
    await this.sendTemplateMessage(to, "booking_confirmation", contentVariables);
  }

  // Groq AI functions
  async getGroqResponse(messages, systemPrompt = null) {
    try {
      const messageArray = [];
      
      if (systemPrompt) {
        messageArray.push({
          role: "system",
          content: systemPrompt
        });
      }
      
      messageArray.push(...messages);
      
      const completion = await this.groq.chat.completions.create({
        messages: messageArray,
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 800,
        top_p: 1
      });
      
      return completion.choices[0]?.message?.content || "";
    } catch (error) {
      logger.error('Groq AI Error:', error);
      return null;
    }
  }

  async transcribeVoiceNote(audioUrl) {
    try {
      logger.info('🎤 Processing voice note from:', audioUrl);
      
      // Simulate transcription delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Enhanced simulated transcriptions with health context
      const simulatedTranscriptions = [
        "I have a severe headache and fever for the past three days, also feeling dizzy",
        "My child has been coughing continuously and has a runny nose, temperature is high",
        "I need a blood pressure check and diabetes screening, feeling very tired lately",
        "I'm experiencing chest pain and shortness of breath, especially when walking",
        "I want to book a general consultation for stomach pain and nausea",
        "Nina maumivu ya kichwa na homa kwa siku tatu zilizopita, pia ninahisi kizunguzungu", // Swahili
        "Mtoto wangu ana kikohozi kila mara na kuhara, joto la mwili ni juu" // Swahili
      ];
      
      const transcription = simulatedTranscriptions[Math.floor(Math.random() * simulatedTranscriptions.length)];
      logger.info('🎤 Transcription completed:', transcription);
      
      return transcription;
    } catch (error) {
      logger.error('Voice transcription error:', error);
      return null;
    }
  }

  async getPersonalizedHealthAdvice(userMessage, healthData) {
    const systemPrompt = `You are MediBot, a professional healthcare assistant for MediPod Africa. 
    
    User Health Context:
    - Name: ${healthData.name || 'User'}
    - Visit Count: ${healthData.visitCount || 0}
    - Previous Conditions: ${healthData.conditions?.join(', ') || 'None'}
    - Preferred Services: ${healthData.preferredServices?.join(', ') || 'None'}
    - Loyalty Points: ${this.loyaltyPoints.get(healthData.phone)?.points || 0}
    
    Provide helpful, professional medical advice and recommendations. Be empathetic, clear, and actionable. 
    Always recommend booking an appointment for serious symptoms. Keep responses under 200 words.
    Consider their health history and loyalty status for personalized recommendations.
    
    IMPORTANT: Never provide definitive medical diagnosis. Always recommend professional medical consultation for serious symptoms.`;

    const messages = [
      {
        role: "user",
        content: `User message: "${userMessage}"
        
        Please provide personalized health advice and recommendations based on their message and health history.`
      }
    ];

    return await this.getGroqResponse(messages, systemPrompt);
  }

  async analyzeSymptoms(symptoms) {
    const systemPrompt = `You are a medical AI assistant analyzing patient symptoms. 
    
    Analyze the symptoms and provide:
    1. Possible conditions (be conservative and general)
    2. Urgency level (low/medium/high)
    3. Recommended next steps
    4. Whether immediate medical attention is needed
    5. Suggested service bundles or follow-up appointments
    
    IMPORTANT GUIDELINES:
    - Be professional and clear
    - Don't provide definitive diagnosis
    - Always recommend professional medical consultation for serious symptoms
    - Focus on guidance and next steps
    - Be conservative in your assessment
    - Consider cultural context for African healthcare`;

    const messages = [
      {
        role: "user",
        content: `Patient symptoms: "${symptoms}"
        
        Please analyze these symptoms and provide guidance.`
      }
    ];

    return await this.getGroqResponse(messages, systemPrompt);
  }

  async analyzeVoiceNote(transcription) {
    const systemPrompt = `You are analyzing a voice note transcription for health symptoms and concerns.
    
    Extract and analyze:
    1. Main symptoms mentioned
    2. Urgency level
    3. Recommended services
    4. Health advice
    5. Follow-up recommendations
    
    Be professional, empathetic, and actionable. Always recommend professional consultation for serious symptoms.`;

    const messages = [
      {
        role: "user",
        content: `Voice transcription: "${transcription}"
        
        Please analyze this voice note and provide health guidance.`
      }
    ];

    return await this.getGroqResponse(messages, systemPrompt);
  }

  async getHealthQuestionAnswer(question) {
    const systemPrompt = `You are a healthcare information assistant. Answer general health questions professionally and accurately.
    
    GUIDELINES:
    - Provide evidence-based information
    - Be clear and easy to understand
    - Always recommend consulting healthcare professionals for specific medical advice
    - Focus on general health information and prevention
    - Be culturally sensitive to African healthcare context
    - Keep responses concise but informative`;

    const messages = [
      {
        role: "user",
        content: `Health question: "${question}"
        
        Please provide a helpful and accurate response.`
      }
    ];

    return await this.getGroqResponse(messages, systemPrompt);
  }

  // Voice response generation
  async generateVoiceResponse(text) {
    try {
      // In a real implementation, you would use a TTS service
      // For now, we'll return the text that would be converted to speech
      logger.info('🎤 Generating voice response for:', text);
      
      // Simulate voice generation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        text: text,
        audioUrl: null, // In production, this would be a URL to the generated audio
        duration: Math.ceil(text.length / 10) // Rough estimate of speech duration
      };
    } catch (error) {
      logger.error('Voice response generation error:', error);
      return null;
    }
  }

  // Send voice response via WhatsApp
  async sendVoiceResponse(to, text) {
    try {
      const voiceResponse = await this.generateVoiceResponse(text);
      
      if (voiceResponse && this.client) {
        // In production, you would upload the audio file and send it
        // For now, we'll send a text message indicating voice response
        await this.sendMessage(to, `🎤 *Voice Response Generated*

"${voiceResponse.text}"

*Duration:* ${voiceResponse.duration} seconds
*Note:* Voice responses will be available in the next update.`);
      } else {
        // Fallback to text message
        await this.sendMessage(to, text);
      }
    } catch (error) {
      logger.error('Error sending voice response:', error);
      // Fallback to text message
      await this.sendMessage(to, text);
    }
  }

  // Get user health data
  async getUserHealthData(phone) {
    try {
      // In production, fetch from database
      // For now, return mock data
      return {
        phone: phone,
        name: '',
        bookings: [],
        conditions: [],
        medications: [],
        lastVisit: null,
        visitCount: 0,
        preferredServices: [],
        paymentMethods: [],
        notifications: {
          medication: true,
          followup: true,
          healthTips: true,
          loyalty: true
        },
        createdAt: new Date()
      };
    } catch (error) {
      logger.error('Error getting user health data:', error);
      return null;
    }
  }

  async handleVoiceProcessing(userPhone, message, session) {
    const choice = message.trim();
    
    switch (choice) {
      case '1':
        session.state = this.STATES.LOCATION_CAPTURE;
        await updateUserSession(userPhone, session);
        await this.requestLocation(userPhone);
        break;
      case '2':
        const healthData = await this.getUserHealthData(userPhone);
        const advice = await this.getPersonalizedHealthAdvice(session.data.transcription, healthData);
        await this.sendVoiceResponse(userPhone, advice || 'Please book an appointment for professional consultation.');
        break;
      case '3':
        session.state = this.STATES.TIME_SELECTION;
        await updateUserSession(userPhone, session);
        await this.sendTimeSelection(userPhone);
        break;
      case '4':
        session.state = this.STATES.MAIN_MENU;
        await updateUserSession(userPhone, session);
        await this.sendMainMenu(userPhone);
        break;
      default:
        await this.sendMessage(userPhone, this.createErrorBubble('Please select a valid option (1-4).'));
    }
  }

  async handleAIRecommendations(userPhone, message, session) {
    const recommendations = await this.getPersonalizedRecommendations(userPhone);
    
    if (recommendations.length === 0) {
      await this.sendMessage(userPhone, `💡 *No specific recommendations at this time.*

Continue with your booking or explore our services!

Reply with *1* to book an appointment or *2* for main menu.`);
    } else {
      let response = `💡 *Personalized Recommendations:*\n\n`;
      recommendations.forEach((rec, index) => {
        response += `${index + 1}️⃣ ${rec.message}\n\n`;
      });
      response += `Reply with *1* to act on any recommendation or *2* for main menu.`;
      
      await this.sendMessage(userPhone, response);
    }
  }

  async handleNotifications(userPhone, message, session) {
    const healthData = await this.getUserHealthData(userPhone);
    
    const notificationMessage = `🔔 *Smart Notifications & Reminders*

Current Settings:
✅ Medication Reminders: ${healthData.notifications.medication ? 'ON' : 'OFF'}
✅ Follow-up Reminders: ${healthData.notifications.followup ? 'ON' : 'OFF'}
✅ Health Tips: ${healthData.notifications.healthTips ? 'ON' : 'OFF'}
✅ Loyalty Updates: ${healthData.notifications.loyalty ? 'ON' : 'OFF'}

*Available Notifications:*
⏰ Medication reminders with specific timing
📅 Follow-up appointment automatic scheduling
❌ Missed appointment notifications
💡 Health tip daily/weekly messages
🏆 Loyalty program notifications
🚐 Van arrival and tracking updates

*Manage Notifications:*
1️⃣ Toggle Medication Reminders
2️⃣ Toggle Follow-up Reminders
3️⃣ Toggle Health Tips
4️⃣ Toggle Loyalty Updates
5️⃣ Set Custom Reminder Times
6️⃣ Back to Main Menu

Reply with your choice (1-6).`;
    
    session.state = this.STATES.NOTIFICATIONS;
    await updateUserSession(userPhone, session);
    await this.sendMessage(userPhone, notificationMessage);
  }

  async handleLoyaltyProgram(userPhone, message, session) {
    const userLoyalty = this.loyaltyPoints.get(userPhone) || { points: 0, history: [] };
    const healthData = await this.getUserHealthData(userPhone);
    
    const loyaltyMessage = `🏆 *Loyalty Program*

*Your Status:*
👤 Name: ${healthData.name || 'User'}
⭐ Total Points: ${userLoyalty.points}
🎯 Visit Count: ${healthData.visitCount}
🏅 Level: ${userLoyalty.points >= 500 ? 'Gold' : userLoyalty.points >= 200 ? 'Silver' : 'Bronze'}

*Recent Activity:*
${userLoyalty.history.slice(-3).map(h => `• ${h.points} points - ${h.reason} (${h.date.toLocaleDateString()})`).join('\n')}

*Rewards Available:*
🎁 100 points = Free logistics fee
🎁 200 points = 10% service discount
🎁 500 points = Free consultation
🎁 1000 points = Complete health package

*Earn Points:*
✅ Each visit: 50 points
✅ Referral: 500 points
✅ Bundle purchase: 100 points
✅ On-time arrival: 25 points

*Actions:*
1️⃣ Redeem Points
2️⃣ View History
3️⃣ Generate Referral Code
4️⃣ Back to Main Menu

Reply with your choice (1-4).`;
    
    session.state = this.STATES.LOYALTY_PROGRAM;
    await updateUserSession(userPhone, session);
    await this.sendMessage(userPhone, loyaltyMessage);
  }

  async handleVanTracking(userPhone, message, session) {
    const activeBooking = this.activeBookings.get(userPhone);
    
    if (!activeBooking) {
      await this.sendMessage(userPhone, `🚐 *Van Tracking*

No active bookings found. 

*To track a van:*
1️⃣ Book an appointment first
2️⃣ Van tracking will be available automatically
3️⃣ Get real-time updates and ETA

*Features:*
📍 GPS location pin sharing
⏰ Real-time ETA countdown updates
🚐 Van arrival notifications
🛣️ Route optimization based on traffic

Reply with *1* to book an appointment or *2* for main menu.`);
      return;
    }
    
    const tracking = this.vanTracking.get(activeBooking.id);
    if (!tracking) {
      await this.sendMessage(userPhone, `🚐 *Van Tracking*

Booking ID: ${activeBooking.id}
Status: Preparing van
ETA: ${activeBooking.timeSlot.name}

*Tracking will be available once van is dispatched.*

Reply with *1* for main menu.`);
      return;
    }
    
    const trackingMessage = `🚐 *Live Van Tracking*

Booking ID: ${activeBooking.id}
📍 Current Location: ${tracking.location}
⏰ ETA: ${tracking.eta}
🔄 Status: ${tracking.status}
📱 Last Update: ${tracking.lastUpdate.toLocaleTimeString()}

📍 Location Pin: https://maps.app.goo.gl/van-${activeBooking.id}

*Actions:*
1️⃣ Refresh Tracking
2️⃣ Contact Driver
3️⃣ Update Location
4️⃣ Back to Main Menu

Reply with your choice (1-4).`;
    
    session.state = this.STATES.VAN_TRACKING;
    await updateUserSession(userPhone, session);
    await this.sendMessage(userPhone, trackingMessage);
  }

  async handleBundleRecommendations(userPhone, message, session) {
    const healthData = await this.getUserHealthData(userPhone);
    
    let bundleMessage = `📦 *Personalized Service Bundles*

Based on your health history and preferences, here are recommended bundles:

*Available Bundles:*`;

    // Generate personalized bundles
    const recommendedBundles = [];
    
    if (healthData.conditions.includes('diabetes') || healthData.preferredServices.includes('monitoring')) {
      recommendedBundles.push(this.SERVICE_BUNDLES.diabetes_care);
    }
    
    if (healthData.preferredServices.includes('specialized')) {
      recommendedBundles.push(this.SERVICE_BUNDLES.women_health);
    }
    
    if (healthData.visitCount >= 2) {
      recommendedBundles.push(this.SERVICE_BUNDLES.family_care);
    }
    
    if (recommendedBundles.length === 0) {
      recommendedBundles.push(this.SERVICE_BUNDLES.diabetes_care, this.SERVICE_BUNDLES.family_care);
    }
    
    recommendedBundles.forEach((bundle, index) => {
      bundleMessage += `\n\n${index + 1}️⃣ ${bundle.name}
   💰 ${bundle.discount}% discount
   📋 ${bundle.description}
   🩺 Services: ${bundle.services.join(', ')}`;
    });
    
    bundleMessage += `

*Benefits:*
✅ Save money with bundle discounts
✅ Comprehensive health screening
✅ Convenient single booking
✅ Priority scheduling

*Actions:*
1️⃣ Book Diabetes Care Package
2️⃣ Book Women's Health Plus
3️⃣ Book Family Health Package
4️⃣ Custom Bundle Request
5️⃣ Back to Main Menu

Reply with your choice (1-5).`;
    
    session.state = this.STATES.BUNDLE_RECOMMENDATIONS;
    await updateUserSession(userPhone, session);
    await this.sendMessage(userPhone, bundleMessage);
  }

  async handleReferralSystem(userPhone, message, session) {
    const healthData = await this.getUserHealthData(userPhone);
    const referralCode = this.generateReferralCode(userPhone);
    
    const referralMessage = `👥 *Refer Friends & Earn Rewards*

*Your Referral Code:* ${referralCode}

*How it Works:*
1️⃣ Share your code with friends
2️⃣ They book using your code
3️⃣ Both get 500 loyalty points
4️⃣ Unlock exclusive rewards

*Current Rewards:*
🎁 500 points for each successful referral
🎁 Free logistics fee after 3 referrals
🎁 50% discount on next visit after 5 referrals
🎁 VIP status after 10 referrals

*Share Message:*
"Hey! I use MediPod Africa for home healthcare. Use my code ${referralCode} when booking and we both get 500 loyalty points! 🏥✨"

*Your Referral Stats:*
👥 Total Referrals: ${this.referralCodes.get(referralCode)?.uses || 0}
🏆 Points Earned: ${(this.referralCodes.get(referralCode)?.uses || 0) * 500}
🎯 Next Milestone: ${5 - (this.referralCodes.get(referralCode)?.uses || 0)} more referrals

*Actions:*
1️⃣ Generate New Code
2️⃣ View Referral History
3️⃣ Share via WhatsApp
4️⃣ Back to Main Menu

Reply with your choice (1-4).`;
    
    session.state = this.STATES.REFERRAL_SYSTEM;
    await updateUserSession(userPhone, session);
    await this.sendMessage(userPhone, referralMessage);
  }

  async handleRescheduleCancel(userPhone, message, session) {
    try {
      const userInput = message.toLowerCase();
      
      if (userInput.includes('cancel') || userInput === '1') {
        // Handle cancellation
        await this.handleCancellation(userPhone, session);
      } else if (userInput.includes('reschedule') || userInput === '2') {
        // Handle rescheduling
        await this.handleRescheduling(userPhone, session);
      } else if (userInput.includes('support') || userInput === '3') {
        // Handle support request
        await this.handleSupportRequest(userPhone);
      } else {
        // Show reschedule/cancel options
        await this.showRescheduleCancelOptions(userPhone, session);
      }
    } catch (error) {
      logger.error('Error handling reschedule/cancel:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error processing your request. Please try again.'));
    }
  }

  async handleCancellation(userPhone, session) {
    try {
      // Get user's active bookings
      const healthData = await this.getUserHealthData(userPhone);
      const activeBookings = healthData.bookings.filter(booking => 
        booking.status === 'confirmed' && 
        new Date(booking.date) > new Date()
      );

      if (activeBookings.length === 0) {
        await this.sendMessage(userPhone, this.createInfoBubble('You have no active bookings to cancel.', '📋 No Active Bookings'));
        return;
      }

      // Cancel the most recent booking
      const latestBooking = activeBookings[activeBookings.length - 1];
      latestBooking.status = 'cancelled';
      latestBooking.cancelledAt = new Date();

      // Update health data
      await this.updateUserHealthData(userPhone, healthData);

      // Refund logic (if payment was made)
      if (session.data.paymentMethod) {
        await this.processRefund(userPhone, latestBooking);
      }

      const cancellationMessage = `❌ *Booking Cancelled Successfully*

📋 Booking ID: ${latestBooking.id}
🩺 Service: ${latestBooking.service}
📅 Date: ${latestBooking.date.toLocaleDateString()}
⏰ Time: ${latestBooking.date.toLocaleTimeString()}

💰 Refund Status: ${session.data.paymentMethod ? 'Processing' : 'No payment made'}

*What's Next:*
1️⃣ Book a new appointment
2️⃣ View booking history
3️⃣ Contact support

Reply with your choice (1-3).`;

      await this.sendMessageWithImage(userPhone, cancellationMessage, this.getRandomImage());
      session.state = this.STATES.MAIN_MENU;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling cancellation:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error cancelling your booking. Please contact support.'));
    }
  }

  async handleRescheduling(userPhone, session) {
    try {
      // Get user's active bookings
      const healthData = await this.getUserHealthData(userPhone);
      const activeBookings = healthData.bookings.filter(booking => 
        booking.status === 'confirmed' && 
        new Date(booking.date) > new Date()
      );

      if (activeBookings.length === 0) {
        await this.sendMessage(userPhone, this.createInfoBubble('You have no active bookings to reschedule.', '📋 No Active Bookings'));
        return;
      }

      // Store rescheduling info in session
      session.data.rescheduling = {
        originalBooking: activeBookings[activeBookings.length - 1],
        step: 'time_selection'
      };

      const rescheduleMessage = `🔄 *Reschedule Your Appointment*

📋 Current Booking: ${activeBookings[activeBookings.length - 1].id}
🩺 Service: ${activeBookings[activeBookings.length - 1].service}
📅 Current Date: ${activeBookings[activeBookings.length - 1].date.toLocaleDateString()}

🕒 *Select New Time Slot:*

1️⃣ 🕒 Morning (9–11 AM)  
2️⃣ 🌤 Midday (11 AM–1 PM)  
3️⃣ ☀️ Afternoon (2–4 PM)

Reply with the number (1-3) of your preferred new time slot.`;

      await this.sendMessageWithImage(userPhone, rescheduleMessage, this.getRandomImage());
      session.state = this.STATES.RESCHEDULE;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling rescheduling:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error rescheduling your booking. Please try again.'));
    }
  }

  async handleRescheduleTimeSelection(userPhone, message, session) {
    try {
      const timeSlot = this.TIME_SLOTS[message];
      if (!timeSlot) {
        await this.sendMessage(userPhone, this.createErrorBubble('Please select a valid time slot (1-3).'));
        return;
      }

      // Update the original booking
      const originalBooking = session.data.rescheduling.originalBooking;
      originalBooking.date = new Date(); // Set to today with new time
      originalBooking.timeSlot = timeSlot;
      originalBooking.rescheduledAt = new Date();

      // Update health data
      const healthData = await this.getUserHealthData(userPhone);
      const bookingIndex = healthData.bookings.findIndex(b => b.id === originalBooking.id);
      if (bookingIndex !== -1) {
        healthData.bookings[bookingIndex] = originalBooking;
        await this.updateUserHealthData(userPhone, healthData);
      }

      const confirmationMessage = `✅ *Appointment Rescheduled Successfully*

📋 Booking ID: ${originalBooking.id}
🩺 Service: ${originalBooking.service}
📅 New Date: ${originalBooking.date.toLocaleDateString()}
🕒 New Time: ${timeSlot.name}

*What's Next:*
1️⃣ View updated booking
2️⃣ Book another appointment
3️⃣ Contact support

Reply with your choice (1-3).`;

      await this.sendMessageWithImage(userPhone, confirmationMessage, this.getRandomImage());
      session.state = this.STATES.MAIN_MENU;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling reschedule time selection:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error rescheduling your appointment. Please try again.'));
    }
  }

  async handleSupportRequest(userPhone) {
    try {
      const supportMessage = `🆘 *MediPod Support*

We're here to help! Choose your support option:

1️⃣ 📞 Call Support (+254 700 000 000)
2️⃣ 💬 WhatsApp Support (+254 700 000 001)
3️⃣ 📧 Email Support (support@medipod.africa)
4️⃣ 🚨 Emergency (999 or 112)

*Common Issues:*
• Payment problems
• Location not found
• Need to reschedule
• Medical emergency

*Quick Actions:*
5️⃣ Book new appointment
6️⃣ View my bookings
7️⃣ Back to main menu

Reply with your choice (1-7).`;

      await this.sendMessageWithImage(userPhone, supportMessage, this.getRandomImage());
      session.state = this.STATES.SUPPORT;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling support request:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error connecting you to support. Please try calling us directly.'));
    }
  }

  async showRescheduleCancelOptions(userPhone, session) {
    try {
      const optionsMessage = `🔄 *Reschedule or Cancel Appointment*

What would you like to do?

1️⃣ ❌ Cancel Visit
2️⃣ 🔄 Reschedule Visit
3️⃣ 🆘 Talk to Support

*Your Active Bookings:*
📋 ${session.data.bookingId || 'MPA-' + Date.now().toString().slice(-4)}
🩺 ${session.data.service?.name || 'General Consultation'}
📅 ${session.data.timeSlot?.name || 'Today at 11:00 AM'}

Reply with your choice (1-3).`;

      await this.sendMessageWithImage(userPhone, optionsMessage, this.getRandomImage());

    } catch (error) {
      logger.error('Error showing reschedule/cancel options:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error loading your options. Please try again.'));
    }
  }

  async processRefund(userPhone, booking) {
    try {
      // Simulate refund process
      logger.info(`Processing refund for booking ${booking.id} to user ${userPhone}`);
      
      // In production, integrate with payment provider
      const refundMessage = `💰 *Refund Processing*

📋 Booking ID: ${booking.id}
💳 Payment Method: ${booking.paymentMethod || 'Unknown'}
💵 Amount: KES ${booking.amount || 0}

⏳ Status: Processing
📅 Expected: 3-5 business days

You'll receive a confirmation once the refund is processed.`;

      await this.sendMessage(userPhone, refundMessage);

    } catch (error) {
      logger.error('Error processing refund:', error);
    }
  }

  async handleViewBookings(userPhone, message, session) {
    try {
      const healthData = await this.getUserHealthData(userPhone);
      const recentBookings = healthData.bookings.slice(-5); // Last 5 bookings

      if (recentBookings.length === 0) {
        const noBookingsMessage = `📋 *Your Bookings*

No bookings found. 

*Quick Actions:*
1️⃣ Book your first appointment
2️⃣ Learn about our services
3️⃣ Back to main menu

Reply with your choice (1-3).`;

        await this.sendMessageWithImage(userPhone, noBookingsMessage, this.getRandomImage());
        return;
      }

      let bookingsMessage = `📋 *Your Recent Bookings*\n\n`;

      recentBookings.forEach((booking, index) => {
        const status = booking.status === 'confirmed' ? '✅ Confirmed' : 
                      booking.status === 'cancelled' ? '❌ Cancelled' : 
                      booking.status === 'completed' ? '✅ Completed' : '⏳ Pending';
        
        bookingsMessage += `${index + 1}️⃣ *${booking.id}*\n`;
        bookingsMessage += `   🩺 ${booking.service}\n`;
        bookingsMessage += `   📅 ${booking.date.toLocaleDateString()}\n`;
        bookingsMessage += `   ⏰ ${booking.date.toLocaleTimeString()}\n`;
        bookingsMessage += `   ${status}\n\n`;
      });

      bookingsMessage += `*Actions:*\n`;
      bookingsMessage += `1️⃣ Book new appointment\n`;
      bookingsMessage += `2️⃣ Reschedule latest booking\n`;
      bookingsMessage += `3️⃣ Cancel latest booking\n`;
      bookingsMessage += `4️⃣ Back to main menu\n\n`;
      bookingsMessage += `Reply with your choice (1-4).`;

      await this.sendMessageWithImage(userPhone, bookingsMessage, this.getRandomImage());

    } catch (error) {
      logger.error('Error handling view bookings:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error loading your bookings. Please try again.'));
    }
  }

  async handleCancellation(userPhone, session) {
    try {
      // Get user's active bookings
      const healthData = await this.getUserHealthData(userPhone);
      const activeBookings = healthData.bookings.filter(booking => 
        booking.status === 'confirmed' && 
        new Date(booking.date) > new Date()
      );

      if (activeBookings.length === 0) {
        await this.sendMessage(userPhone, this.createInfoBubble('You have no active bookings to cancel.', '📋 No Active Bookings'));
        return;
      }

      // Cancel the most recent booking
      const latestBooking = activeBookings[activeBookings.length - 1];
      latestBooking.status = 'cancelled';
      latestBooking.cancelledAt = new Date();

      // Update health data
      await this.updateUserHealthData(userPhone, healthData);

      // Refund logic (if payment was made)
      if (session.data.paymentMethod) {
        await this.processRefund(userPhone, latestBooking);
      }

      const cancellationMessage = `❌ *Booking Cancelled Successfully*

📋 Booking ID: ${latestBooking.id}
🩺 Service: ${latestBooking.service}
📅 Date: ${latestBooking.date.toLocaleDateString()}
⏰ Time: ${latestBooking.date.toLocaleTimeString()}

💰 Refund Status: ${session.data.paymentMethod ? 'Processing' : 'No payment made'}

*What's Next:*
1️⃣ Book a new appointment
2️⃣ View booking history
3️⃣ Contact support

Reply with your choice (1-3).`;

      await this.sendMessageWithImage(userPhone, cancellationMessage, this.getRandomImage());
      session.state = this.STATES.MAIN_MENU;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling cancellation:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error cancelling your booking. Please contact support.'));
    }
  }

  async handleRescheduling(userPhone, session) {
    try {
      // Get user's active bookings
      const healthData = await this.getUserHealthData(userPhone);
      const activeBookings = healthData.bookings.filter(booking => 
        booking.status === 'confirmed' && 
        new Date(booking.date) > new Date()
      );

      if (activeBookings.length === 0) {
        await this.sendMessage(userPhone, this.createInfoBubble('You have no active bookings to reschedule.', '📋 No Active Bookings'));
        return;
      }

      // Store rescheduling info in session
      session.data.rescheduling = {
        originalBooking: activeBookings[activeBookings.length - 1],
        step: 'time_selection'
      };

      const rescheduleMessage = `🔄 *Reschedule Your Appointment*

📋 Current Booking: ${activeBookings[activeBookings.length - 1].id}
🩺 Service: ${activeBookings[activeBookings.length - 1].service}
📅 Current Date: ${activeBookings[activeBookings.length - 1].date.toLocaleDateString()}

🕒 *Select New Time Slot:*

1️⃣ 🕒 Morning (9–11 AM)  
2️⃣ 🌤 Midday (11 AM–1 PM)  
3️⃣ ☀️ Afternoon (2–4 PM)

Reply with the number (1-3) of your preferred new time slot.`;

      await this.sendMessageWithImage(userPhone, rescheduleMessage, this.getRandomImage());
      session.state = this.STATES.RESCHEDULE;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling rescheduling:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error rescheduling your booking. Please try again.'));
    }
  }

  async handleRescheduleTimeSelection(userPhone, message, session) {
    try {
      const timeSlot = this.TIME_SLOTS[message];
      if (!timeSlot) {
        await this.sendMessage(userPhone, this.createErrorBubble('Please select a valid time slot (1-3).'));
        return;
      }

      // Update the original booking
      const originalBooking = session.data.rescheduling.originalBooking;
      originalBooking.date = new Date(); // Set to today with new time
      originalBooking.timeSlot = timeSlot;
      originalBooking.rescheduledAt = new Date();

      // Update health data
      const healthData = await this.getUserHealthData(userPhone);
      const bookingIndex = healthData.bookings.findIndex(b => b.id === originalBooking.id);
      if (bookingIndex !== -1) {
        healthData.bookings[bookingIndex] = originalBooking;
        await this.updateUserHealthData(userPhone, healthData);
      }

      const confirmationMessage = `✅ *Appointment Rescheduled Successfully*

📋 Booking ID: ${originalBooking.id}
🩺 Service: ${originalBooking.service}
📅 New Date: ${originalBooking.date.toLocaleDateString()}
🕒 New Time: ${timeSlot.name}

*What's Next:*
1️⃣ View updated booking
2️⃣ Book another appointment
3️⃣ Contact support

Reply with your choice (1-3).`;

      await this.sendMessageWithImage(userPhone, confirmationMessage, this.getRandomImage());
      session.state = this.STATES.MAIN_MENU;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling reschedule time selection:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error rescheduling your appointment. Please try again.'));
    }
  }

  async handleSupportRequest(userPhone) {
    try {
      const supportMessage = `🆘 *MediPod Support*

We're here to help! Choose your support option:

1️⃣ 📞 Call Support (+254 700 000 000)
2️⃣ 💬 WhatsApp Support (+254 700 000 001)
3️⃣ 📧 Email Support (support@medipod.africa)
4️⃣ 🚨 Emergency (999 or 112)

*Common Issues:*
• Payment problems
• Location not found
• Need to reschedule
• Medical emergency

*Quick Actions:*
5️⃣ Book new appointment
6️⃣ View my bookings
7️⃣ Back to main menu

Reply with your choice (1-7).`;

      await this.sendMessageWithImage(userPhone, supportMessage, this.getRandomImage());
      session.state = this.STATES.SUPPORT;
      await updateUserSession(userPhone, session);

    } catch (error) {
      logger.error('Error handling support request:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error connecting you to support. Please try calling us directly.'));
    }
  }

  async showRescheduleCancelOptions(userPhone, session) {
    try {
      const optionsMessage = `🔄 *Reschedule or Cancel Appointment*

What would you like to do?

1️⃣ ❌ Cancel Visit
2️⃣ 🔄 Reschedule Visit
3️⃣ 🆘 Talk to Support

*Your Active Bookings:*
📋 ${session.data.bookingId || 'MPA-' + Date.now().toString().slice(-4)}
🩺 ${session.data.service?.name || 'General Consultation'}
📅 ${session.data.timeSlot?.name || 'Today at 11:00 AM'}

Reply with your choice (1-3).`;

      await this.sendMessageWithImage(userPhone, optionsMessage, this.getRandomImage());

    } catch (error) {
      logger.error('Error showing reschedule/cancel options:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error loading your options. Please try again.'));
    }
  }

  async processRefund(userPhone, booking) {
    try {
      // Simulate refund process
      logger.info(`Processing refund for booking ${booking.id} to user ${userPhone}`);
      
      // In production, integrate with payment provider
      const refundMessage = `💰 *Refund Processing*

📋 Booking ID: ${booking.id}
💳 Payment Method: ${booking.paymentMethod || 'Unknown'}
💵 Amount: KES ${booking.amount || 0}

⏳ Status: Processing
📅 Expected: 3-5 business days

You'll receive a confirmation once the refund is processed.`;

      await this.sendMessage(userPhone, refundMessage);

    } catch (error) {
      logger.error('Error processing refund:', error);
    }
  }

  async handleViewBookings(userPhone, message, session) {
    try {
      const healthData = await this.getUserHealthData(userPhone);
      const recentBookings = healthData.bookings.slice(-5); // Last 5 bookings

      if (recentBookings.length === 0) {
        const noBookingsMessage = `📋 *Your Bookings*

No bookings found. 

*Quick Actions:*
1️⃣ Book your first appointment
2️⃣ Learn about our services
3️⃣ Back to main menu

Reply with your choice (1-3).`;

        await this.sendMessageWithImage(userPhone, noBookingsMessage, this.getRandomImage());
        return;
      }

      let bookingsMessage = `📋 *Your Recent Bookings*\n\n`;

      recentBookings.forEach((booking, index) => {
        const status = booking.status === 'confirmed' ? '✅ Confirmed' : 
                      booking.status === 'cancelled' ? '❌ Cancelled' : 
                      booking.status === 'completed' ? '✅ Completed' : '⏳ Pending';
        
        bookingsMessage += `${index + 1}️⃣ *${booking.id}*\n`;
        bookingsMessage += `   🩺 ${booking.service}\n`;
        bookingsMessage += `   📅 ${booking.date.toLocaleDateString()}\n`;
        bookingsMessage += `   ⏰ ${booking.date.toLocaleTimeString()}\n`;
        bookingsMessage += `   ${status}\n\n`;
      });

      bookingsMessage += `*Actions:*\n`;
      bookingsMessage += `1️⃣ Book new appointment\n`;
      bookingsMessage += `2️⃣ Reschedule latest booking\n`;
      bookingsMessage += `3️⃣ Cancel latest booking\n`;
      bookingsMessage += `4️⃣ Back to main menu\n\n`;
      bookingsMessage += `Reply with your choice (1-4).`;

      await this.sendMessageWithImage(userPhone, bookingsMessage, this.getRandomImage());

    } catch (error) {
      logger.error('Error handling view bookings:', error);
      await this.sendMessage(userPhone, this.createErrorBubble('Sorry, there was an error loading your bookings. Please try again.'));
    }
  }

  // Helper functions for loyalty and referrals
  generateReferralCode(phone) {
    const code = `MEDI${phone.slice(-4)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    this.referralCodes.set(code, {
      phone,
      createdAt: new Date(),
      uses: 0
    });
    return code;
  }

  async getPersonalizedRecommendations(phone) {
    const healthData = await this.getUserHealthData(phone);
    const userLoyalty = this.loyaltyPoints.get(phone);
    const recommendations = [];
    
    // Based on recent conditions
    if (healthData.conditions.includes('UTI')) {
      const tips = this.HEALTH_TIPS.UTI;
      recommendations.push({
        type: 'health_tip',
        message: `💡 Hi ${healthData.name || 'there'}, here's a UTI prevention tip: ${tips[Math.floor(Math.random() * tips.length)]}`
      });
    }
    
    if (healthData.conditions.includes('diabetes')) {
      const tips = this.HEALTH_TIPS.diabetes;
      recommendations.push({
        type: 'reminder',
        message: `💡 Hi ${healthData.name || 'there'}, diabetes management tip: ${tips[Math.floor(Math.random() * tips.length)]}`
      });
    }
    
    // Based on visit frequency and loyalty
    if (healthData.visitCount >= 3) {
      const points = userLoyalty?.points || 0;
      if (points >= 100) {
        recommendations.push({
          type: 'loyalty',
          message: `🎁 You have ${points} loyalty points! Redeem for free logistics or service discounts.`
        });
      } else {
        recommendations.push({
          type: 'loyalty',
          message: `🎁 Because you've used MediPod ${healthData.visitCount} times, your next logistics fee is free!`
        });
      }
    }
    
    return recommendations;
  }

  // Helper functions for zone calculation and notifications
  calculateZone(location) {
    const locationLower = location.toLowerCase();
    if (locationLower.includes('westlands') || locationLower.includes('kileleshwa')) return 'A';
    if (locationLower.includes('south b') || locationLower.includes('hurlingham') || locationLower.includes('parklands')) return 'B';
    if (locationLower.includes('ruaka') || locationLower.includes('rongai') || locationLower.includes('embakasi')) return 'C';
    if (locationLower.includes('kitengela') || locationLower.includes('juja') || locationLower.includes('limuru')) return 'D';
    if (locationLower.includes('thika') || locationLower.includes('ngong') || locationLower.includes('athi river')) return 'E';
    return 'B'; // Default to Zone B
  }

  // Smart Notification System
  scheduleNotification(phone, type, message, delayMinutes = 0) {
    const notification = {
      phone,
      type,
      message,
      scheduledFor: new Date(Date.now() + delayMinutes * 60 * 1000),
      sent: false
    };
    
    if (!this.notificationQueue.has(phone)) {
      this.notificationQueue.set(phone, []);
    }
    this.notificationQueue.get(phone).push(notification);
    
    // Schedule the notification
    setTimeout(() => {
      this.sendScheduledNotification(phone, notification);
    }, delayMinutes * 60 * 1000);
  }

  async sendScheduledNotification(phone, notification) {
    if (!notification.sent) {
      logger.info(`Sending notification to ${phone}: ${notification.message}`);
      notification.sent = true;
      // Send via Twilio API
      await this.sendMessage(phone, notification.message);
    }
  }

  // Van Tracking System
  updateVanLocation(bookingId, location, eta) {
    this.vanTracking.set(bookingId, {
      location,
      eta,
      lastUpdate: new Date(),
      status: 'en_route'
    });
  }

  generateVanTrackingMessage(bookingId) {
    const tracking = this.vanTracking.get(bookingId);
    if (!tracking) return null;
    
    return `🚐 *Van Tracking Update*

📍 Current Location: ${tracking.location}
⏰ ETA: ${tracking.eta}
🔄 Status: ${tracking.status}
📱 Last Update: ${tracking.lastUpdate.toLocaleTimeString()}

📍 Location Pin: https://maps.app.goo.gl/van-${bookingId}`;
  }

  // Loyalty Program System
  addLoyaltyPoints(phone, points, reason) {
    if (!this.loyaltyPoints.has(phone)) {
      this.loyaltyPoints.set(phone, { points: 0, history: [] });
    }
    
    const userLoyalty = this.loyaltyPoints.get(phone);
    userLoyalty.points += points;
    userLoyalty.history.push({
      points,
      reason,
      date: new Date()
    });
    
    return userLoyalty.points;
  }
}

// Initialize and export bot instance
let botInstance = null;

async function initializeWhatsAppBot(io) {
  if (!botInstance) {
    botInstance = new WhatsAppBot();
    logger.info('🤖 WhatsApp Bot initialized successfully');
  }
  return botInstance;
}

module.exports = {
  WhatsAppBot,
  initializeWhatsAppBot,
  getBotInstance: () => botInstance
}; 