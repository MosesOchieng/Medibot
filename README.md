# MediPod Africa WhatsApp Bot

A comprehensive WhatsApp Business API bot for mobile healthcare services in Africa, built with Node.js and Express.

## 🏥 Overview

MediPod Africa is a mobile healthcare service that brings medical care to your doorstep. This WhatsApp bot serves as the primary interface for patients to book appointments, make payments, and receive healthcare services.

## 🚀 Features

### Core Bot Features
- **Multi-language Support**: English and Swahili
- **Voice Note Processing**: Accept voice messages for easier communication
- **Image Support**: Handle prescription photos and medical images
- **Quick Replies**: Button-based navigation
- **Menu Navigation**: Number-based selection system

### Booking System
- **Location-based Pricing**: Zone-based logistics fees
- **Service Selection**: Multiple healthcare services
- **Time Slot Booking**: Flexible scheduling
- **Real-time ETA**: Vehicle tracking and arrival estimates

### Payment Integration
- **M-Pesa Integration**: STK Push payments via Daraja API
- **NHIF Support**: National Health Insurance Fund integration
- **Wallet System**: Internal MediPod wallet
- **Payment Verification**: Automatic payment confirmation

### Healthcare Services
- Blood Pressure / Diabetes Check
- Women's Health
- Child Check-Up
- Mental Health
- General Consultation
- Custom Services

### Notification System
- **Booking Confirmations**: WhatsApp notifications
- **Payment Reminders**: Automated payment alerts
- **Medication Reminders**: Prescription follow-ups
- **Health Tips**: Educational content
- **Emergency Alerts**: Critical notifications

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Cache**: Redis
- **WhatsApp API**: Twilio WhatsApp Business API
- **Payment**: M-Pesa Daraja API
- **Maps**: Google Maps API
- **Logging**: Winston

### Service Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp Bot  │    │  Session Mgmt   │    │   Database      │
│   (Main Logic)  │◄──►│   (Redis)       │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Payment Svc   │    │  Notification   │    │   Logistics     │
│   (M-Pesa/NHIF) │    │   (SMS/WA)      │    │   (Routing)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- Redis 6+
- Twilio Account
- M-Pesa Daraja API credentials
- Google Maps API key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd medipod-africa-whatsapp-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/medipod_db
   REDIS_URL=redis://localhost:6379
   
   # Twilio WhatsApp
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=whatsapp:+14155238886
   
   # M-Pesa
   MPESA_CONSUMER_KEY=your_mpesa_consumer_key
   MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
   MPESA_BUSINESS_SHORT_CODE=your_business_shortcode
   MPESA_PASSKEY=your_mpesa_passkey
   MPESA_ENVIRONMENT=sandbox
   
   # Google Maps
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   
   # JWT
   JWT_SECRET=your_jwt_secret_key_here
   ```

4. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb medipod_db
   
   # Run migrations (tables are auto-created on startup)
   npm start
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### WhatsApp Business API Setup

1. **Twilio Configuration**
   - Create a Twilio account
   - Set up WhatsApp Business API
   - Configure webhook URL: `https://your-domain.com/api/whatsapp/webhook`

2. **Webhook Verification**
   - Set `WHATSAPP_VERIFY_TOKEN` in environment
   - Verify webhook with WhatsApp

### M-Pesa Integration

1. **Daraja API Setup**
   - Register for M-Pesa Daraja API
   - Get consumer key and secret
   - Configure business shortcode and passkey

2. **Callback URL**
   - Set callback URL: `https://your-domain.com/api/payment/mpesa/callback`

### Google Maps API

1. **API Key Setup**
   - Create Google Cloud project
   - Enable Maps JavaScript API
   - Generate API key with restrictions

## 📱 Bot Flow

### 1. Welcome Message
```
👋🏾 Hi there! I'm MediBot — your digital health assistant from MediPod Africa.

🎤 You can record a voice note to tell me your issue  
📲 Or use the quick menu below to get started.

🩺 Book Health Visit  
🎙 Send Voice Note  
ℹ️ How This Works
```

### 2. Main Menu
```
🔍 What would you like to do?

1️⃣ Book a Health Visit  
2️⃣ View My Bookings  
3️⃣ Reschedule or Cancel Visit  
4️⃣ Call for Help
```

### 3. Booking Flow
1. **Location Capture**: User shares location
2. **Service Selection**: Choose healthcare service
3. **Time Selection**: Pick appointment time
4. **Payment**: M-Pesa, NHIF, or Wallet
5. **Confirmation**: Booking details and ETA

### 4. Pricing Zones
| Zone | Range | Fee (KES) | ETA | Sample Areas |
|------|-------|-----------|-----|--------------|
| A | 0–3 km | 200 | 15–30 mins | Westlands, Kileleshwa |
| B | 3–7 km | 300 | 30–45 mins | South B, Hurlingham |
| C | 7–12 km | 400 | 45–60 mins | Ruaka, Rongai |
| D | 12–20 km | 500–600 | 1–2 hrs | Kitengela, Juja |
| E | >20 km | Custom | +2 hrs | Thika, Ngong |

## 🚐 Vehicle Management

### Vehicle Assignment
- **Real-time Tracking**: GPS coordinates
- **Nearest Vehicle**: Algorithm-based assignment
- **Capacity Management**: Load balancing
- **Route Optimization**: Google Maps integration

### Vehicle Equipment
- Medical equipment (BP machine, glucometer, etc.)
- Touchscreen panel for data entry
- LED display for advertising
- Power system (inverter/solar)

## 💳 Payment System

### M-Pesa Integration
```javascript
// STK Push payment
const payment = await processPayment({
  method: 'mpesa',
  amount: 300,
  phone: '+254700000000',
  description: 'MediPod Logistics Fee'
});
```

### Payment Verification
- Automatic callback processing
- Payment status tracking
- Receipt generation
- Refund handling

## 📊 Analytics & Monitoring

### Dashboard Metrics
- Active sessions
- Booking statistics
- Payment analytics
- Notification delivery rates

### Real-time Monitoring
- Vehicle locations
- Booking status
- Payment confirmations
- System health

## 🔒 Security & Compliance

### Data Protection
- **Encryption**: TLS + AES encryption
- **Consent Management**: Explicit user consent
- **GDPR Compliance**: Data privacy standards
- **Access Control**: Role-based permissions

### Medical Data Security
- **HIPAA-inspired**: Medical data protection
- **Data Retention**: Automatic cleanup policies
- **Audit Logging**: Complete activity tracking

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## 📈 Deployment

### Production Setup
1. **Environment**: Set `NODE_ENV=production`
2. **SSL**: Configure HTTPS certificates
3. **Load Balancer**: Set up reverse proxy
4. **Monitoring**: Configure health checks
5. **Backup**: Database and Redis backup strategy

### Docker Deployment
```bash
# Build image
docker build -t medipod-bot .

# Run container
docker run -p 3000:3000 --env-file .env medipod-bot
```

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/server.js --name medipod-bot

# Monitor
pm2 monit
```

## 🔧 API Endpoints

### WhatsApp Webhook
- `POST /api/whatsapp/webhook` - Incoming messages
- `GET /api/whatsapp/webhook` - Webhook verification

### Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/bookings/today` - Today's bookings
- `PUT /api/admin/bookings/:id/status` - Update booking status

### Payment
- `POST /api/payment/mpesa/callback` - M-Pesa callback
- `POST /api/payment/mpesa/verify` - Verify payment

### Bookings
- `GET /api/booking/user/:phone` - User bookings
- `PUT /api/booking/:id/cancel` - Cancel booking

## 📞 Support

### Emergency Contacts
- **Technical Support**: tech@medipod.africa
- **Medical Emergency**: +254 700 000 000
- **WhatsApp Support**: +254 700 000 000

### Documentation
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Troubleshooting](./docs/troubleshooting.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Twilio for WhatsApp Business API
- Safaricom for M-Pesa Daraja API
- Google Maps Platform
- Open source community

---

**MediPod Africa** - Bringing healthcare to your doorstep 🚐🏥 