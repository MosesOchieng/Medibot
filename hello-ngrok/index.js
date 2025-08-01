const http = require('http');
const ngrok = require('@ngrok/ngrok');
const querystring = require('querystring');
const Groq = require('groq-sdk');

console.log('Starting MediBot WhatsApp server with Advanced AI Features...');

// Initialize Groq AI
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Simple in-memory session storage (for demo purposes)
const userSessions = new Map();

// Mock user health data for AI recommendations
const userHealthData = new Map();

// Advanced notification system
const notificationQueue = new Map();
const scheduledNotifications = new Map();

// Van tracking system
const vanTracking = new Map();
const activeBookings = new Map();

// Loyalty program system
const loyaltyPoints = new Map();
const referralCodes = new Map();

// Bot states
const STATES = {
  WELCOME: 'WELCOME',
  MAIN_MENU: 'MAIN_MENU',
  LOCATION_CAPTURE: 'LOCATION_CAPTURE',
  SERVICE_SELECTION: 'SERVICE_SELECTION',
  TIME_SELECTION: 'TIME_SELECTION',
  LOGISTICS_CALCULATION: 'LOGISTICS_CALCULATION',
  PAYMENT_METHOD: 'PAYMENT_METHOD',
  PAYMENT_CONFIRMATION: 'PAYMENT_CONFIRMATION',
  PREDIAGNOSIS: 'PREDIAGNOSIS',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  VIEW_BOOKINGS: 'VIEW_BOOKINGS',
  RESCHEDULE_CANCEL: 'RESCHEDULE_CANCEL',
  HELP: 'HELP',
  VAN_ARRIVAL: 'VAN_ARRIVAL',
  AI_RECOMMENDATIONS: 'AI_RECOMMENDATIONS',
  VOICE_PROCESSING: 'VOICE_PROCESSING',
  NOTIFICATIONS: 'NOTIFICATIONS',
  LOYALTY_PROGRAM: 'LOYALTY_PROGRAM',
  VAN_TRACKING: 'VAN_TRACKING',
  BUNDLE_RECOMMENDATIONS: 'BUNDLE_RECOMMENDATIONS',
  REFERRAL_SYSTEM: 'REFERRAL_SYSTEM'
};

// Service types with emojis
const SERVICES = {
  '1': { name: '🩸 Blood Pressure / Diabetes Check', price: 500, duration: 30, category: 'monitoring' },
  '2': { name: "🧬 Women's Health", price: 800, duration: 45, category: 'specialized' },
  '3': { name: '🧒🏽 Child Check-Up', price: 600, duration: 30, category: 'pediatric' },
  '4': { name: '🧠 Mental Health', price: 1000, duration: 60, category: 'specialized' },
  '5': { name: '🩺 General Consultation', price: 400, duration: 25, category: 'general' },
  '6': { name: '❓ Other (we\'ll ask more)', price: 500, duration: 30, category: 'general' }
};

// Service bundles for recommendations
const SERVICE_BUNDLES = {
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
const TIME_SLOTS = {
  '1': { name: '🕒 Morning (9–11 AM)', start: '09:00', end: '11:00' },
  '2': { name: '🌤 Midday (11 AM–1 PM)', start: '11:00', end: '13:00' },
  '3': { name: '☀️ Afternoon (2–4 PM)', start: '14:00', end: '16:00' }
};

// Zone-based pricing
const ZONES = {
  'A': { name: 'Zone A', fee: 200, eta: '15–30 mins', areas: 'Westlands, Kileleshwa' },
  'B': { name: 'Zone B', fee: 300, eta: '30–45 mins', areas: 'South B, Hurlingham, Parklands' },
  'C': { name: 'Zone C', fee: 400, eta: '45–60 mins', areas: 'Ruaka, Rongai, Embakasi' },
  'D': { name: 'Zone D', fee: 500, eta: '1–2 hrs', areas: 'Kitengela, Juja, Limuru' },
  'E': { name: 'Zone E', fee: 600, eta: '+2 hrs', areas: 'Thika, Ngong, Athi River' }
};

// Health tips by condition
const HEALTH_TIPS = {
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

// Helper function to create TwiML response
function createTwiMLResponse(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${message}</Message>
</Response>`;
}

// WhatsApp-style bubble responses
function createThinkingBubble() {
  const image = getRandomImage();
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

function createProcessingBubble(action) {
  const actions = {
    'payment': '💳 Processing payment...',
    'booking': '📅 Confirming booking...',
    'location': '📍 Calculating logistics...',
    'voice': '🎤 Transcribing voice note...',
    'ai': '🧠 AI analyzing symptoms...',
    'tracking': '🚐 Updating van location...'
  };
  
  const message = actions[action] || '⏳ Processing...';
  const image = getRandomImage();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

${message}
⏳ Please wait...
    </Message>
</Response>`;
}

function createSuccessBubble(message, type = 'success') {
  const icons = {
    'success': '✅',
    'payment': '💳',
    'booking': '📅',
    'health': '🏥',
    'loyalty': '🏆',
    'tracking': '🚐'
  };
  
  const icon = icons[type] || '✅';
  const image = getRandomImage();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

${icon} ${message}
    </Message>
</Response>`;
}

function createErrorBubble(message) {
  const image = getRandomImage();
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

function createInfoBubble(message, title = 'ℹ️ Information') {
  const image = getRandomImage();
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${image}

${title}
${message}
    </Message>
</Response>`;
}

// Smart Notification System
function scheduleNotification(phone, type, message, delayMinutes = 0) {
  const notification = {
    phone,
    type,
    message,
    scheduledFor: new Date(Date.now() + delayMinutes * 60 * 1000),
    sent: false
  };
  
  if (!notificationQueue.has(phone)) {
    notificationQueue.set(phone, []);
  }
  notificationQueue.get(phone).push(notification);
  
  // Schedule the notification
  setTimeout(() => {
    sendNotification(phone, notification);
  }, delayMinutes * 60 * 1000);
}

function sendNotification(phone, notification) {
  if (!notification.sent) {
    console.log(`Sending notification to ${phone}: ${notification.message}`);
    notification.sent = true;
    // In production, this would send via Twilio API
  }
}

// Van Tracking System
function updateVanLocation(bookingId, location, eta) {
  vanTracking.set(bookingId, {
    location,
    eta,
    lastUpdate: new Date(),
    status: 'en_route'
  });
}

function generateVanTrackingMessage(bookingId) {
  const tracking = vanTracking.get(bookingId);
  if (!tracking) return null;
  
  return `🚐 *Van Tracking Update*

📍 Current Location: ${tracking.location}
⏰ ETA: ${tracking.eta}
🔄 Status: ${tracking.status}
📱 Last Update: ${tracking.lastUpdate.toLocaleTimeString()}

📍 Location Pin: https://maps.app.goo.gl/van-${bookingId}`;
}

// Loyalty Program System
function addLoyaltyPoints(phone, points, reason) {
  if (!loyaltyPoints.has(phone)) {
    loyaltyPoints.set(phone, { points: 0, history: [] });
  }
  
  const userLoyalty = loyaltyPoints.get(phone);
  userLoyalty.points += points;
  userLoyalty.history.push({
    points,
    reason,
    date: new Date()
  });
  
  return userLoyalty.points;
}

function generateReferralCode(phone) {
  const code = `MEDI${phone.slice(-4)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  referralCodes.set(code, {
    phone,
    createdAt: new Date(),
    uses: 0
  });
  return code;
}

// Groq AI functions
async function getGroqResponse(messages, systemPrompt = null) {
  try {
    const messageArray = [];
    
    if (systemPrompt) {
      messageArray.push({
        role: "system",
        content: systemPrompt
      });
    }
    
    messageArray.push(...messages);
    
    const completion = await groq.chat.completions.create({
      messages: messageArray,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 800,
      top_p: 1
    });
    
    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error('Groq AI Error:', error);
    return null;
  }
}

async function transcribeVoiceNote(audioUrl) {
  try {
    console.log('🎤 Processing voice note from:', audioUrl);
    
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
    console.log('🎤 Transcription completed:', transcription);
    
    return transcription;
  } catch (error) {
    console.error('Voice transcription error:', error);
    return null;
  }
}

async function getPersonalizedHealthAdvice(userMessage, healthData) {
  const systemPrompt = `You are MediBot, a professional healthcare assistant for MediPod Africa. 
  
  User Health Context:
  - Name: ${healthData.name || 'User'}
  - Visit Count: ${healthData.visitCount}
  - Previous Conditions: ${healthData.conditions.join(', ') || 'None'}
  - Preferred Services: ${healthData.preferredServices.join(', ') || 'None'}
  - Loyalty Points: ${loyaltyPoints.get(healthData.phone)?.points || 0}
  
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

  return await getGroqResponse(messages, systemPrompt);
}

async function analyzeSymptoms(symptoms) {
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

  return await getGroqResponse(messages, systemPrompt);
}

async function analyzeVoiceNote(transcription) {
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

  return await getGroqResponse(messages, systemPrompt);
}

async function getHealthQuestionAnswer(question) {
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

  return await getGroqResponse(messages, systemPrompt);
}

// Get or create user session
function getUserSession(phone) {
  if (!userSessions.has(phone)) {
    userSessions.set(phone, {
      phone: phone,
      state: STATES.WELCOME,
      data: {},
      createdAt: new Date()
    });
  }
  return userSessions.get(phone);
}

// Update user session
function updateUserSession(phone, sessionData) {
  const session = getUserSession(phone);
  Object.assign(session, sessionData);
  userSessions.set(phone, session);
}

// Get or create user health data
function getUserHealthData(phone) {
  if (!userHealthData.has(phone)) {
    userHealthData.set(phone, {
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
    });
  }
  return userHealthData.get(phone);
}

// Update user health data
function updateUserHealthData(phone, healthData) {
  const data = getUserHealthData(phone);
  Object.assign(data, healthData);
  userHealthData.set(phone, data);
}

// AI-powered personalized recommendations with advanced features
function getPersonalizedRecommendations(phone) {
  const healthData = getUserHealthData(phone);
  const userLoyalty = loyaltyPoints.get(phone);
  const recommendations = [];
  
  // Based on recent conditions
  if (healthData.conditions.includes('UTI')) {
    const tips = HEALTH_TIPS.UTI;
    recommendations.push({
      type: 'health_tip',
      message: `💡 Hi ${healthData.name || 'there'}, here's a UTI prevention tip: ${tips[Math.floor(Math.random() * tips.length)]}`
    });
  }
  
  if (healthData.conditions.includes('diabetes')) {
    const tips = HEALTH_TIPS.diabetes;
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
  
  // Bundle recommendations based on usage patterns
  if (healthData.preferredServices.includes('monitoring') && healthData.preferredServices.includes('general')) {
    recommendations.push({
      type: 'bundle',
      message: `📦 Recommended: Complete Health Package (Blood Pressure + General Consultation) - 20% off!`
    });
  }
  
  // Medication reminders with smart timing
  if (healthData.medications.length > 0) {
    const currentHour = new Date().getHours();
    if (currentHour === 9) {
      recommendations.push({
        type: 'medication',
        message: `⏰ Medication Reminder: Take your ${healthData.medications[0]} now.`
      });
    }
  }
  
  // Follow-up reminders with smart scheduling
  if (healthData.lastVisit) {
    const daysSinceLastVisit = Math.floor((new Date() - new Date(healthData.lastVisit)) / (1000 * 60 * 60 * 24));
    if (daysSinceLastVisit >= 7) {
      recommendations.push({
        type: 'followup',
        message: `📅 Hi ${healthData.name || 'there'}, it's time for your follow-up checkup. Would you like to book a van?`
      });
    }
  }
  
  // Referral program
  if (healthData.visitCount >= 2) {
    const referralCode = generateReferralCode(phone);
    recommendations.push({
      type: 'referral',
      message: `👥 Refer a friend! Use code ${referralCode} and both get 500 loyalty points.`
    });
  }
  
  return recommendations;
}

// Generate van arrival message with ETA
function generateVanArrivalMessage(phone, bookingData) {
  const healthData = getUserHealthData(phone);
  const name = healthData.name || 'there';
  
  return `✅ Hi ${name}! Your Medipod van has arrived at your location. 

📍 Use this pin to find us: https://maps.app.goo.gl/van-location

🧾 Your service will begin shortly. If you'd like to reschedule or cancel, reply 'Change'.

🚐 ETA: 2 minutes. Your Medipod Van is on the way!

*Service:* ${bookingData.service.name}
*Time:* ${bookingData.timeSlot.name}`;
}

// Calculate zone based on location (simplified)
function calculateZone(location) {
  const locationLower = location.toLowerCase();
  if (locationLower.includes('westlands') || locationLower.includes('kileleshwa')) return 'A';
  if (locationLower.includes('south b') || locationLower.includes('hurlingham') || locationLower.includes('parklands')) return 'B';
  if (locationLower.includes('ruaka') || locationLower.includes('rongai') || locationLower.includes('embakasi')) return 'C';
  if (locationLower.includes('kitengela') || locationLower.includes('juja') || locationLower.includes('limuru')) return 'D';
  if (locationLower.includes('thika') || locationLower.includes('ngong') || locationLower.includes('athi river')) return 'E';
  return 'B'; // Default to Zone B
}

// Handle different bot states
async function handleBotState(phone, message, session) {
  const userInput = message.trim().toLowerCase();
  
  switch (session.state) {
    case STATES.WELCOME:
      return handleWelcomeState(phone, userInput, session);
    
    case STATES.MAIN_MENU:
      return handleMainMenu(phone, userInput, session);
    
    case STATES.LOCATION_CAPTURE:
      return handleLocationCapture(phone, userInput, session);
    
    case STATES.SERVICE_SELECTION:
      return handleServiceSelection(phone, userInput, session);
    
    case STATES.TIME_SELECTION:
      return handleTimeSelection(phone, userInput, session);
    
    case STATES.LOGISTICS_CALCULATION:
      return handleLogisticsCalculation(phone, userInput, session);
    
    case STATES.PAYMENT_METHOD:
      return handlePaymentMethod(phone, userInput, session);
    
    case STATES.PAYMENT_CONFIRMATION:
      return handlePaymentConfirmation(phone, userInput, session);
    
    case STATES.PREDIAGNOSIS:
      return handlePrediagnosis(phone, userInput, session);
    
    case STATES.VIEW_BOOKINGS:
      return handleViewBookings(phone, userInput, session);
    
    case STATES.RESCHEDULE_CANCEL:
      return handleRescheduleCancel(phone, userInput, session);
    
    case STATES.HELP:
      return handleHelp(phone, userInput, session);
    
    case STATES.VAN_ARRIVAL:
      return handleVanArrival(phone, userInput, session);
    
    case STATES.AI_RECOMMENDATIONS:
      return handleAIRecommendations(phone, userInput, session);
    
    case STATES.VOICE_PROCESSING:
      return handleVoiceProcessing(phone, userInput, session);
    
    case STATES.NOTIFICATIONS:
      return handleNotifications(phone, userInput, session);
    
    case STATES.LOYALTY_PROGRAM:
      return handleLoyaltyProgram(phone, userInput, session);
    
    case STATES.VAN_TRACKING:
      return handleVanTracking(phone, userInput, session);
    
    case STATES.BUNDLE_RECOMMENDATIONS:
      return handleBundleRecommendations(phone, userInput, session);
    
    case STATES.REFERRAL_SYSTEM:
      return handleReferralSystem(phone, userInput, session);
    
    default:
      return handleWelcomeState(phone, userInput, session);
  }
}

async function handleWelcomeState(phone, message, session) {
  // Get personalized recommendations
  const recommendations = getPersonalizedRecommendations(phone);
  const healthData = getUserHealthData(phone);
  
  // Random image selection with proper URL
  const baseUrl = 'http://localhost:8080'; // ngrok will provide the public URL
  const images = [
    `${baseUrl}/public/40137bc3-0535-480a-9ef7-693a6195e5da.jpg`,
    `${baseUrl}/public/0D70D2FC-93B4-4410-92AF-0E9894AFBF80.png`,
    `${baseUrl}/public/4ABF8ED5-76C5-4520-9976-FC1A827FFFEE.png`,
    `${baseUrl}/public/3F393526-4BB6-474B-A6DA-623986E8A858.png`
  ];
  const randomImage = images[Math.floor(Math.random() * images.length)];
  
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

  // For ngrok version, we'll send the image URL in the message
  const messageWithImage = `${randomImage}\n\n${introMessage}`;

  updateUserSession(phone, { state: STATES.MAIN_MENU });
  return createTwiMLResponse(messageWithImage);
}

async function handleMainMenu(phone, message, session) {
  if (message === '1' || message.includes('book') || message.includes('health visit')) {
    updateUserSession(phone, { state: STATES.LOCATION_CAPTURE });
    return createTwiMLResponse(`📍 *Step 1: Share Your Location*

Please share your location 📍  
(You can type the name of your estate, or pin your current location.)

*Example:* "Kilimani, Nairobi" or "Westlands, ABC Street"

*Behind the scenes:* Bot calculates distance from nearest MediPod base + determines your zone for pricing and ETA.`);
  } else if (message === '2' || message.includes('view') || message.includes('bookings')) {
    return handleViewBookings(phone, message, session);
  } else if (message === '3' || message.includes('reschedule') || message.includes('cancel')) {
    return handleRescheduleCancel(phone, message, session);
  } else if (message === '4' || message.includes('help') || message.includes('call')) {
    return handleHelp(phone, message, session);
  } else if (message === '5' || message.includes('notification')) {
    return handleNotifications(phone, message, session);
  } else if (message === '6' || message.includes('loyalty')) {
    return handleLoyaltyProgram(phone, message, session);
  } else if (message === '7' || message.includes('tracking') || message.includes('van')) {
    return handleVanTracking(phone, message, session);
  } else if (message === '8' || message.includes('bundle')) {
    return handleBundleRecommendations(phone, message, session);
  } else if (message === '9' || message.includes('refer')) {
    return handleReferralSystem(phone, message, session);
  } else if (message.includes('voice') || message.includes('record')) {
    return createTwiMLResponse(`🎤 *Advanced Voice Note Feature*

Great! You can record a voice note to describe your symptoms or health concerns.

*Multi-language Support:*
🇺🇸 English
🇹🇿 Swahili

*How to use:*
1️⃣ Tap the microphone icon in WhatsApp
2️⃣ Record your message in English or Swahili
3️⃣ Send the voice note
4️⃣ I'll transcribe and analyze your symptoms

*AI Features:*
🧠 Symptom extraction and analysis
💡 Personalized health recommendations
📋 Automatic service suggestions
🔄 Follow-up appointment scheduling

*Or* you can continue with text by typing your location.`);
  } else if (message.includes('how') || message.includes('works')) {
    const infoMessage = `ℹ️ *How MediPod Works:*

1️⃣ *Book Appointment* - Choose service and time
2️⃣ *Share Location* - We calculate logistics  
3️⃣ *Make Payment* - M-Pesa, NHIF, or Wallet
4️⃣ *Get ETA* - Real-time vehicle tracking
5️⃣ *Receive Care* - Professional medical team

*Advanced Features:*
🔔 Smart Notifications & Reminders
🚐 Real-time Van Tracking with GPS
🧠 AI-Powered Health Recommendations
🎤 Multi-language Voice Processing
🏆 Loyalty Program with Points
📦 Personalized Service Bundles
👥 Referral Rewards System

*Our Promise:*
✅ Licensed medical professionals
✅ Same-day appointments  
✅ Transparent pricing
✅ 24/7 support
✅ AI-powered personalization

*Pricing Zones:*
🟢 Zone A (0-3km): KES 200 - 15-30 mins
🟡 Zone B (3-7km): KES 300 - 30-45 mins  
🟠 Zone C (7-12km): KES 400 - 45-60 mins
🔴 Zone D (12-20km): KES 500-600 - 1-2 hrs
⚫ Zone E (>20km): Custom - +2 hrs

Reply with *1* to book an appointment now!`;
    
    updateUserSession(phone, { state: STATES.MAIN_MENU });
    return createTwiMLResponse(infoMessage);
  } else {
    // Use Groq AI for intelligent responses to unexpected inputs
    const healthData = getUserHealthData(phone);
    const aiResponse = await getPersonalizedHealthAdvice(message, healthData);
    
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
      
      return createTwiMLResponse(intelligentResponse);
    } else {
      return createTwiMLResponse(`Please reply with:
*1* - Book a Health Visit
*2* - View My Bookings  
*3* - Reschedule or Cancel Visit
*4* - Call for Help
*5* - 🔔 Smart Notifications
*6* - 🏆 Loyalty Program
*7* - 🚐 Van Tracking
*8* - 📦 Service Bundles
*9* - 👥 Refer Friends`);
    }
  }
}

function handleLocationCapture(phone, message, session) {
  // Store location in session
  session.data.location = message;
  const zone = calculateZone(message);
  session.data.zone = zone;
  
  updateUserSession(phone, { 
    state: STATES.SERVICE_SELECTION,
    data: { ...session.data, location: message, zone: zone }
  });
  
  const serviceMessage = `📍 *Location Confirmed!*

✅ Location: ${message}
🗺️ Zone: ${ZONES[zone].name}
💰 Logistics Fee: KES ${ZONES[zone].fee}
⏰ ETA: ${ZONES[zone].eta}

🩺 *Step 2: Choose Service*

What service do you need today?

1️⃣ 🩸 Blood Pressure / Diabetes Check  
2️⃣ 🧬 Women's Health  
3️⃣ 🧒🏽 Child Check-Up  
4️⃣ 🧠 Mental Health  
5️⃣ 🩺 General Consultation  
6️⃣ ❓ Other (we'll ask more)

Reply with the number (1-6) of your preferred service.`;
  
  return createSuccessBubble(serviceMessage, 'location');
}

function handleServiceSelection(phone, message, session) {
  const serviceNumber = message.trim();
  const service = SERVICES[serviceNumber];
  
  if (!service) {
    return createErrorBubble('Please select a valid service (1-6).');
  }
  
  session.data.service = service;
  
  // Update user health data with service preference
  const healthData = getUserHealthData(phone);
  if (!healthData.preferredServices.includes(service.category)) {
    healthData.preferredServices.push(service.category);
    updateUserHealthData(phone, healthData);
  }
  
  updateUserSession(phone, { 
    state: STATES.TIME_SELECTION,
    data: { ...session.data, service: service }
  });
  
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
  
  return createSuccessBubble(timeMessage, 'health');
}

function handleTimeSelection(phone, message, session) {
  const timeNumber = message.trim();
  const timeSlot = TIME_SLOTS[timeNumber];
  
  if (!timeSlot) {
    return createErrorBubble('Please select a valid time slot (1-3).');
  }
  
  session.data.timeSlot = timeSlot;
  
  updateUserSession(phone, { 
    state: STATES.LOGISTICS_CALCULATION,
    data: { ...session.data, timeSlot: timeSlot }
  });
  
  return handleLogisticsCalculation(phone, message, session);
}

function handleLogisticsCalculation(phone, message, session) {
  const zone = session.data.zone || 'B';
  const zoneInfo = ZONES[zone];
  
  const logisticsMessage = `✅ *Logistics Calculated!*

📍 Location: ${session.data.location}  
🚐 Estimated Van ETA: ${zoneInfo.eta}  
💰 Logistics Fee: KES ${zoneInfo.fee}  
🩺 Service Fee: Starting from KES ${session.data.service.price} (paid on visit)

*Service:* ${session.data.service.name}
*Time:* ${session.data.timeSlot.name}

Please pay KES ${zoneInfo.fee} now to confirm your booking.`;
  
  updateUserSession(phone, { 
    state: STATES.PAYMENT_METHOD,
    data: { ...session.data, logisticsFee: zoneInfo.fee }
  });
  
  return createSuccessBubble(logisticsMessage, 'booking');
}

function handlePaymentMethod(phone, message, session) {
  const paymentMessage = `🔐 *Choose Payment Method*

1️⃣ 📲 M-PESA (STK Push sent)  
2️⃣ 🧾 NHIF (NHIF Card No.)  
3️⃣ 💼 MediPod Wallet (Your phone = Wallet ID)

Reply with your preferred payment method (1-3).`;
  
  updateUserSession(phone, { state: STATES.PAYMENT_CONFIRMATION });
  return createInfoBubble(paymentMessage, '💳 Payment Options');
}

function handlePaymentConfirmation(phone, message, session) {
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
      return createErrorBubble('Please select a valid payment method (1-3).');
  }
  
  session.data.paymentMethod = paymentMethod;
  
  // Update user health data with payment preference
  const healthData = getUserHealthData(phone);
  if (!healthData.paymentMethods.includes(paymentMethod)) {
    healthData.paymentMethods.push(paymentMethod);
    updateUserHealthData(phone, healthData);
  }
  
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
  
  updateUserSession(phone, { 
    state: STATES.PREDIAGNOSIS,
    data: { ...session.data, paymentMethod: paymentMethod }
  });
  
  return createSuccessBubble(confirmationMessage, 'payment');
}

function handlePrediagnosis(phone, message, session) {
  if (message.toLowerCase() === 'skip') {
    return completeBooking(phone, session);
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
    const healthData = getUserHealthData(phone);
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
    
    updateUserHealthData(phone, healthData);
    
    return completeBooking(phone, session);
  }
}

function completeBooking(phone, session) {
  // Update user health data with booking
  const healthData = getUserHealthData(phone);
  healthData.visitCount += 1;
  healthData.lastVisit = new Date();
  const bookingId = `MPA-${Date.now().toString().slice(-4)}`;
  healthData.bookings.push({
    id: bookingId,
    service: session.data.service.name,
    date: new Date(),
    status: 'confirmed'
  });
  updateUserHealthData(phone, healthData);
  
  // Add loyalty points
  const pointsEarned = addLoyaltyPoints(phone, 50, 'Booking completed');
  const userLoyalty = loyaltyPoints.get(phone);
  
  // Store active booking for van tracking
  activeBookings.set(phone, {
    id: bookingId,
    service: session.data.service,
    timeSlot: session.data.timeSlot,
    location: session.data.location,
    status: 'confirmed'
  });
  
  // Schedule notifications
  scheduleNotification(phone, 'reminder', `Reminder: Your MediPod appointment is in 1 hour. Van will arrive at ${session.data.timeSlot.start}`, 60);
  scheduleNotification(phone, 'arrival', `Your MediPod van has arrived! Please meet the medical team at your location.`, 120);
  
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
  
  updateUserSession(phone, { state: STATES.MAIN_MENU });
  return createSuccessBubble(finalMessage, 'booking');
}

function handleViewBookings(phone, message, session) {
  const healthData = getUserHealthData(phone);
  const recentBookings = healthData.bookings.slice(-3); // Last 3 bookings
  
  let bookingsMessage = `📋 *Your Recent Bookings:*\n\n`;
  
  if (recentBookings.length === 0) {
    bookingsMessage += `No recent bookings found. Book your first appointment with us!`;
  } else {
    recentBookings.forEach((booking, index) => {
      bookingsMessage += `${index + 1}️⃣ *${booking.id}* - ${booking.service}\n   📅 ${booking.date.toLocaleDateString()} at ${booking.date.toLocaleTimeString()}\n   ✅ ${booking.status}\n\n`;
    });
  }
  
  bookingsMessage += `Reply with *1* to book a new appointment or *2* to go back to main menu.`;
  
  updateUserSession(phone, { state: STATES.MAIN_MENU });
  return createTwiMLResponse(bookingsMessage);
}

function handleRescheduleCancel(phone, message, session) {
  const rescheduleMessage = `🔄 *Would you like to cancel or reschedule?*

1️⃣ Cancel Visit  
2️⃣ Reschedule Visit  
3️⃣ Talk to Support

*Your Active Bookings:*
📋 MPA-${Date.now().toString().slice(-4)} - ${session.data.service?.name || 'General Consultation'}
📅 ${session.data.timeSlot?.name || 'Today at 11:00 AM'}

Reply with your choice (1-3).`;
  
  updateUserSession(phone, { state: STATES.MAIN_MENU });
  return createTwiMLResponse(rescheduleMessage);
}

function handleHelp(phone, message, session) {
  const helpMessage = `🆘 *Need Help?*

*Contact Options:*
📞 Call: +254 700 000 000
📧 Email: support@medipod.africa
💬 WhatsApp: +254 700 000 001

*Emergency:* Call 999 or 112

*Common Issues:*
❓ Payment problems
❓ Location not found
❓ Need to reschedule
❓ Medical emergency

*Quick Actions:*
1️⃣ Book new appointment
2️⃣ View my bookings
3️⃣ Talk to human agent

Reply with your choice or call us directly.`;
  
  updateUserSession(phone, { state: STATES.MAIN_MENU });
  return createTwiMLResponse(helpMessage);
}

function handleVanArrival(phone, message, session) {
  if (message.toLowerCase() === 'change') {
    return createTwiMLResponse(`🔄 *Reschedule/Cancel Options:*

1️⃣ Reschedule for later today
2️⃣ Cancel this visit
3️⃣ Talk to support

Reply with your choice (1-3).`);
  } else {
    return createTwiMLResponse(`✅ *Van Arrival Confirmed*

Your medical team is ready to provide care. Please meet them at the location pin.

If you need anything else, just reply!`);
  }
}

function handleAIRecommendations(phone, message, session) {
  const recommendations = getPersonalizedRecommendations(phone);
  
  if (recommendations.length === 0) {
    return createTwiMLResponse(`💡 *No specific recommendations at this time.*

Continue with your booking or explore our services!

Reply with *1* to book an appointment or *2* for main menu.`);
  } else {
    let message = `💡 *Personalized Recommendations:*\n\n`;
    recommendations.forEach((rec, index) => {
      message += `${index + 1}️⃣ ${rec.message}\n\n`;
    });
    message += `Reply with *1* to act on any recommendation or *2* for main menu.`;
    
    return createTwiMLResponse(message);
  }
}

// New Advanced Feature Handlers

function handleNotifications(phone, message, session) {
  const healthData = getUserHealthData(phone);
  
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
  
  updateUserSession(phone, { state: STATES.NOTIFICATIONS });
  return createTwiMLResponse(notificationMessage);
}

function handleLoyaltyProgram(phone, message, session) {
  const userLoyalty = loyaltyPoints.get(phone) || { points: 0, history: [] };
  const healthData = getUserHealthData(phone);
  
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
  
  updateUserSession(phone, { state: STATES.LOYALTY_PROGRAM });
  return createTwiMLResponse(loyaltyMessage);
}

function handleVanTracking(phone, message, session) {
  const activeBooking = activeBookings.get(phone);
  
  if (!activeBooking) {
    return createTwiMLResponse(`🚐 *Van Tracking*

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
  }
  
  const tracking = vanTracking.get(activeBooking.id);
  if (!tracking) {
    return createTwiMLResponse(`🚐 *Van Tracking*

Booking ID: ${activeBooking.id}
Status: Preparing van
ETA: ${activeBooking.timeSlot.name}

*Tracking will be available once van is dispatched.*

Reply with *1* for main menu.`);
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
  
  updateUserSession(phone, { state: STATES.VAN_TRACKING });
  return createTwiMLResponse(trackingMessage);
}

function handleBundleRecommendations(phone, message, session) {
  const healthData = getUserHealthData(phone);
  
  let bundleMessage = `📦 *Personalized Service Bundles*

Based on your health history and preferences, here are recommended bundles:

*Available Bundles:*`;

  // Generate personalized bundles
  const recommendedBundles = [];
  
  if (healthData.conditions.includes('diabetes') || healthData.preferredServices.includes('monitoring')) {
    recommendedBundles.push(SERVICE_BUNDLES.diabetes_care);
  }
  
  if (healthData.preferredServices.includes('specialized')) {
    recommendedBundles.push(SERVICE_BUNDLES.women_health);
  }
  
  if (healthData.visitCount >= 2) {
    recommendedBundles.push(SERVICE_BUNDLES.family_care);
  }
  
  if (recommendedBundles.length === 0) {
    recommendedBundles.push(SERVICE_BUNDLES.diabetes_care, SERVICE_BUNDLES.family_care);
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
  
  updateUserSession(phone, { state: STATES.BUNDLE_RECOMMENDATIONS });
  return createTwiMLResponse(bundleMessage);
}

function handleReferralSystem(phone, message, session) {
  const healthData = getUserHealthData(phone);
  const referralCode = generateReferralCode(phone);
  
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
👥 Total Referrals: ${referralCodes.get(referralCode)?.uses || 0}
🏆 Points Earned: ${(referralCodes.get(referralCode)?.uses || 0) * 500}
🎯 Next Milestone: ${5 - (referralCodes.get(referralCode)?.uses || 0)} more referrals

*Actions:*
1️⃣ Generate New Code
2️⃣ View Referral History
3️⃣ Share via WhatsApp
4️⃣ Back to Main Menu

Reply with your choice (1-4).`;
  
  updateUserSession(phone, { state: STATES.REFERRAL_SYSTEM });
  return createTwiMLResponse(referralMessage);
}

function handleVoiceProcessing(phone, message, session) {
  // Enhanced voice processing with AI analysis
  return createTwiMLResponse(`🎤 *Voice Processing Complete*

*AI Analysis Results:*
🧠 Symptom extraction completed
💡 Health recommendations generated
📋 Service suggestions ready
🔄 Follow-up scheduling available

*Next Steps:*
1️⃣ Book recommended service
2️⃣ Get detailed health advice
3️⃣ Schedule follow-up
4️⃣ Back to main menu

Reply with your choice (1-4).`);
}

// Helper function to get random image
function getRandomImage() {
  const baseUrl = 'http://localhost:8080'; // ngrok will provide the public URL
  const images = [
    `${baseUrl}/public/40137bc3-0535-480a-9ef7-693a6195e5da.jpg`,
    `${baseUrl}/public/0D70D2FC-93B4-4410-92AF-0E9894AFBF80.png`,
    `${baseUrl}/public/4ABF8ED5-76C5-4520-9976-FC1A827FFFEE.png`,
    `${baseUrl}/public/3F393526-4BB6-474B-A6DA-623986E8A858.png`
  ];
  return images[Math.floor(Math.random() * images.length)];
}

// Helper function to create TwiML response with image
function createTwiMLResponseWithImage(message, imageUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
${imageUrl}

${message}
    </Message>
</Response>`;
}

// Create webserver
const server = http.createServer(async (req, res) => {
	console.log('Request received:', req.url);
	console.log('Request method:', req.method);
	
	// Serve static files (images)
	if (req.method === 'GET' && req.url.startsWith('/public/')) {
		const filePath = req.url.substring(1); // Remove leading slash
		const fs = require('fs');
		const path = require('path');
		
		try {
			const fullPath = path.join(__dirname, '..', filePath);
			const stat = fs.statSync(fullPath);
			
			if (stat.isFile()) {
				const ext = path.extname(fullPath).toLowerCase();
				const contentType = {
					'.jpg': 'image/jpeg',
					'.jpeg': 'image/jpeg',
					'.png': 'image/png',
					'.gif': 'image/gif'
				}[ext] || 'application/octet-stream';
				
				res.writeHead(200, { 'Content-Type': contentType });
				fs.createReadStream(fullPath).pipe(res);
				return;
			}
		} catch (error) {
			console.log('File not found:', req.url);
		}
	}
	
	// Handle Twilio WhatsApp webhook
	if (req.method === 'POST') {
		let body = '';
		
		req.on('data', chunk => {
			body += chunk.toString();
		});
		
		req.on('end', async () => {
			console.log('Received POST data:', body);
			
			// Parse the form data
			const formData = querystring.parse(body);
			const incomingMessage = formData.Body || '';
			const fromNumber = formData.From || '';
			const numMedia = parseInt(formData.NumMedia) || 0;
			const mediaUrl = formData.MediaUrl0 || '';
			
			console.log('Message from:', fromNumber);
			console.log('Message content:', incomingMessage);
			console.log('Has media:', numMedia > 0);
			
			try {
				// Get user session
				const userPhone = fromNumber.replace('whatsapp:', '');
				const session = getUserSession(userPhone);
				
				// Handle voice notes or media with enhanced processing
				if (numMedia > 0 && mediaUrl) {
					console.log('🎤 Processing voice note...');
					
					// Send processing bubble immediately
					res.writeHead(200, { 'Content-Type': 'text/xml' });
					res.end(createProcessingBubble('voice'));
					
					// Process voice note in background
					setTimeout(async () => {
						try {
							const transcription = await transcribeVoiceNote(mediaUrl);
							if (transcription) {
								console.log('🎤 Voice transcription:', transcription);
								
								// Analyze with AI
								const aiAnalysis = await analyzeVoiceNote(transcription);
								console.log('🧠 AI analysis:', aiAnalysis);
								
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
								updateUserSession(userPhone, { 
									state: STATES.VOICE_PROCESSING,
									data: { ...session.data, transcription, aiAnalysis }
								});
								
								// Note: In a real implementation, you'd send this via Twilio API
								console.log('Voice processing response ready:', voiceResponse);
							}
						} catch (error) {
							console.error('Voice processing error:', error);
						}
					}, 3000);
					
					return;
				}
				
				// Handle text messages with bubble responses
				let response;
				
				// Check if it's a health question (not a menu selection)
				if (incomingMessage.length > 20 && !/^[1-9]$/.test(incomingMessage.trim())) {
					// Send thinking bubble for health questions
					res.writeHead(200, { 'Content-Type': 'text/xml' });
					res.end(createThinkingBubble());
					
					// Process with AI in background
					setTimeout(async () => {
						try {
							const healthData = getUserHealthData(userPhone);
							const aiResponse = await getPersonalizedHealthAdvice(incomingMessage, healthData);
							
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
								
								console.log('AI health response:', intelligentResponse);
							}
						} catch (error) {
							console.error('AI processing error:', error);
						}
					}, 2000);
					
					return;
				}
				
				// Handle regular bot state processing
				response = await handleBotState(userPhone, incomingMessage, session);
				
				// Send TwiML response
				res.writeHead(200, { 'Content-Type': 'text/xml' });
				res.end(response);
				
			} catch (error) {
				console.error('Error handling message:', error);
				// Send error bubble
				const twiml = createErrorBubble('There was an error processing your request. Please try again.');
				res.writeHead(200, { 'Content-Type': 'text/xml' });
				res.end(twiml);
			}
		});
	} else {
		// Handle GET requests (like browser visits)
	res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(`
			<h1>🏥 MediPod Africa WhatsApp Bot</h1>
			<p>Your AI-powered WhatsApp bot is running with advanced features!</p>
			<p>Send a message to your Twilio WhatsApp number to interact with the bot.</p>
			<p><strong>Advanced Features available:</strong></p>
			<ul>
				<li>🧠 AI-powered health analysis and recommendations</li>
				<li>🎤 Multi-language voice note processing</li>
				<li>⏰ Smart notifications and reminders</li>
				<li>📅 Follow-up appointment suggestions</li>
				<li>🎁 Loyalty rewards and points system</li>
				<li>🚐 Real-time van tracking with GPS</li>
				<li>📊 Health history tracking</li>
				<li>💡 Condition-specific health tips</li>
				<li>🔄 Intelligent booking management</li>
				<li>📦 Personalized service bundles</li>
				<li>👥 Referral rewards system</li>
				<li>🔔 WhatsApp-style bubble responses</li>
			</ul>
			<p><strong>AI Integration:</strong> Groq AI for intelligent health conversations</p>
		`);
	}
});

server.listen(8080, () => {
	console.log('MediBot WhatsApp server at 8080 is running...');

// Get your endpoint online
	console.log('Connecting to ngrok...');
ngrok.connect({ addr: 8080, authtoken_from_env: true })
		.then(listener => {
			console.log(`Ingress established at: ${listener.url()}`);
			console.log('✅ AI-Powered MediBot is now connected to WhatsApp!');
			console.log('📱 Send a message to your Twilio WhatsApp number to start using the bot.');
		})
		.catch(err => {
			console.error('Ngrok connection failed:', err);
			process.exit(1);
		});
});

// Handle process termination
process.on('SIGINT', () => {
	console.log('Shutting down MediBot...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});