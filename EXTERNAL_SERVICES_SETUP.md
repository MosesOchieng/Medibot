# 🗄️ External Services Setup Guide

## 📊 **Database Setup (Supabase - Recommended)**

### **Step 1: Create Supabase Account**
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub or email
4. Create a new project

### **Step 2: Get Database URL**
1. Go to Settings → Database
2. Copy the connection string
3. Format: `postgresql://postgres:[password]@[host]:5432/postgres`

### **Step 3: Set Environment Variable**
```bash
# Add to your .env file
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

## 🔴 **Redis Setup (Upstash - Recommended for Vercel)**

### **Step 1: Create Upstash Account**
1. Go to [https://upstash.com](https://upstash.com)
2. Click "Get Started"
3. Sign up with GitHub or email
4. Create a new Redis database

### **Step 2: Get Redis URL**
1. Go to your Redis database
2. Copy the connection string
3. Format: `redis://[username]:[password]@[host]:[port]`

### **Step 3: Set Environment Variable**
```bash
# Add to your .env file
REDIS_URL=redis://[username]:[password]@[host]:[port]
```

## 🌐 **Alternative Services**

### **Database Alternatives:**
1. **Neon** - [https://neon.tech](https://neon.tech)
2. **Railway** - [https://railway.app](https://railway.app)
3. **PlanetScale** - [https://planetscale.com](https://planetscale.com)

### **Redis Alternatives:**
1. **Redis Cloud** - [https://redis.com](https://redis.com)
2. **Railway Redis** - [https://railway.app](https://railway.app)
3. **AWS ElastiCache** - [https://aws.amazon.com](https://aws.amazon.com)

## 🔧 **Environment Variables Setup**

### **Complete .env File:**
```bash
# Database
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres

# Redis
REDIS_URL=redis://[username]:[password]@[host]:[port]

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=whatsapp:+1234567890

# AI
GROQ_API_KEY=gsk_...

# App
NODE_ENV=production
BASE_URL=https://your-app.vercel.app
```

## 🚀 **Deployment Steps**

### **Step 1: Push to GitHub**
```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: MediPod WhatsApp Bot with external services"

# Add remote repository
git remote add origin https://github.com/MosesOchieng/Medibot.git

# Push to GitHub
git push -u origin main
```

### **Step 2: Deploy to Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### **Step 3: Set Environment Variables in Vercel**
```bash
# Set each environment variable
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_PHONE_NUMBER
vercel env add GROQ_API_KEY
```

## ✅ **Verification Steps**

### **1. Test Database Connection**
```bash
# Check if database is accessible
curl https://your-app.vercel.app/health
```

### **2. Test Redis Connection**
```bash
# Check Redis in logs
vercel logs
```

### **3. Test Image Loading**
```bash
# Check if images load
curl https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&h=300&fit=crop
```

## 🎯 **Production Checklist**

- ✅ **Database** connected and working
- ✅ **Redis** connected and working
- ✅ **Images** loading from external URLs
- ✅ **Environment variables** set in Vercel
- ✅ **Twilio webhook** configured
- ✅ **GitHub repository** updated
- ✅ **Vercel deployment** successful

## 📞 **Support**

If you encounter issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test database connections
4. Check image URLs
5. Verify Twilio webhook configuration

Your WhatsApp bot will work perfectly with these external services! 🎉 