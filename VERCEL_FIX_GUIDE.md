# 🔧 Vercel Deployment Fix Guide

## 🚨 **Error Analysis: FUNCTION_INVOCATION_FAILED**

### **Root Causes:**
1. **Missing Environment Variables** - Database/Redis connections failing
2. **Missing Dependencies** - Some packages not installed
3. **Initialization Errors** - Services failing to start
4. **Memory Issues** - Serverless function limits

## ✅ **Step-by-Step Fix:**

### **1. Set All Required Environment Variables in Vercel:**

Go to your Vercel dashboard → Project Settings → Environment Variables

```bash
# Required Variables:
NODE_ENV=production
PORT=3000

# Twilio (You already have these)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=whatsapp:+1234567890

# Groq AI
GROQ_API_KEY=your_groq_api_key_here

# Database (Choose one)
DATABASE_URL=postgresql://username:password@host:5432/database

# Redis (Choose one)
REDIS_URL=redis://username:password@host:port

# App Configuration
BASE_URL=https://your-app.vercel.app
```

### **2. Set Up External Services:**

#### **Option A: Supabase (Database)**
```bash
# 1. Go to https://supabase.com
# 2. Create account and project
# 3. Get connection string from Settings → Database
# 4. Add to Vercel environment variables
```

#### **Option B: Upstash (Redis)**
```bash
# 1. Go to https://upstash.com
# 2. Create account and Redis database
# 3. Get connection string
# 4. Add to Vercel environment variables
```

### **3. Update vercel.json for Better Error Handling:**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/public/(.*)",
      "dest": "/public/$1"
    },
    {
      "src": "/uploads/(.*)",
      "dest": "/uploads/$1"
    },
    {
      "src": "/api/(.*)",
      "dest": "src/server.js"
    },
    {
      "src": "/health",
      "dest": "src/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/server.js": {
      "maxDuration": 30
    }
  }
}
```

### **4. Test Deployment:**

```bash
# Deploy to Vercel
vercel --prod

# Check logs
vercel logs

# Test health endpoint
curl https://your-app.vercel.app/health
```

## 🤖 **AI Recommendations Frequency Configuration**

### **Current AI Recommendation Triggers:**

#### **1. Welcome Message (Every Time):**
- ✅ Personalized recommendations based on health history
- ✅ Loyalty points status
- ✅ Service bundle suggestions

#### **2. Health Questions (On Demand):**
- ✅ When user asks health questions
- ✅ When user sends voice notes
- ✅ When user types long messages

#### **3. Booking Completion (After Each Booking):**
- ✅ Follow-up appointment suggestions
- ✅ Related service recommendations
- ✅ Loyalty rewards

### **Configurable Frequency Settings:**

#### **Option 1: Conservative (Recommended)**
```javascript
// AI recommendations appear:
- ✅ Welcome message (every time)
- ✅ Health questions (on demand)
- ✅ Booking completion (after each booking)
- ✅ Weekly health tips (if user opts in)
- ❌ No unsolicited recommendations
```

#### **Option 2: Moderate**
```javascript
// AI recommendations appear:
- ✅ Welcome message (every time)
- ✅ Health questions (on demand)
- ✅ Booking completion (after each booking)
- ✅ Daily health tips (if user opts in)
- ✅ Service suggestions (every 3rd interaction)
```

#### **Option 3: Active**
```javascript
// AI recommendations appear:
- ✅ Welcome message (every time)
- ✅ Health questions (on demand)
- ✅ Booking completion (after each booking)
- ✅ Daily health tips (if user opts in)
- ✅ Service suggestions (every interaction)
- ✅ Medication reminders (if applicable)
- ✅ Follow-up reminders (7 days after visit)
```

### **Current Configuration (Conservative):**

Your bot currently uses the **Conservative** approach:
- **No spam** - Only relevant recommendations
- **User-triggered** - AI responds when user asks
- **Context-aware** - Based on user's health history
- **Opt-in notifications** - User controls frequency

### **To Change Frequency:**

#### **For More Frequent Recommendations:**
```javascript
// Add to src/services/whatsappBot.js
const AI_RECOMMENDATION_FREQUENCY = {
  welcome: true,           // Every welcome message
  healthQuestions: true,   // On health questions
  bookingComplete: true,   // After booking
  dailyTips: false,        // Daily health tips
  serviceSuggestions: false, // Service ads
  medicationReminders: false, // Medication reminders
  followUpReminders: false   // Follow-up reminders
};
```

#### **For Less Frequent Recommendations:**
```javascript
// Set to false for fewer recommendations
const AI_RECOMMENDATION_FREQUENCY = {
  welcome: true,           // Keep welcome recommendations
  healthQuestions: true,   // Keep health Q&A
  bookingComplete: false,  // Remove booking recommendations
  dailyTips: false,        // No daily tips
  serviceSuggestions: false, // No service ads
  medicationReminders: false, // No medication reminders
  followUpReminders: false   // No follow-up reminders
};
```

## 🎯 **Recommended Settings:**

### **For Production (Balanced):**
- ✅ **Welcome recommendations** - Every time
- ✅ **Health Q&A** - On demand
- ✅ **Booking completion** - After each booking
- ❌ **Daily tips** - User opt-in only
- ❌ **Service ads** - Only when relevant
- ❌ **Medication reminders** - Only if user has medications

### **For Testing (Active):**
- ✅ **All recommendations enabled**
- ✅ **Daily health tips**
- ✅ **Service suggestions**
- ✅ **Medication reminders**

## 📊 **Current AI Recommendation Types:**

1. **Health Tips** - Condition-specific advice
2. **Service Bundles** - Discounted packages
3. **Loyalty Rewards** - Points and benefits
4. **Follow-up Appointments** - Based on visit history
5. **Medication Reminders** - If user has medications
6. **Preventive Care** - Based on age and conditions

## 🚀 **Next Steps:**

1. **Fix Vercel deployment** by setting environment variables
2. **Test the deployment** with health check
3. **Configure AI frequency** based on your preference
4. **Monitor user engagement** and adjust accordingly

Your bot will work perfectly once the environment variables are set! 🎉 