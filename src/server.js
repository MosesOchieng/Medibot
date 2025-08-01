const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Import routes and services
const whatsappRoutes = require('./routes/whatsapp');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');
const bookingRoutes = require('./routes/booking');
const userRoutes = require('./routes/user');

// Import services
const { initializeDatabase } = require('./database/connection');
const { initializeRedis } = require('./services/redis');
const logger = require('./utils/logger');
const { initializeWhatsAppBot } = require('./services/whatsappBot');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ADMIN_DASHBOARD_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'MediPod WhatsApp Bot',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/user', userRoutes);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info('Admin dashboard connected');
  
  socket.on('disconnect', () => {
    logger.info('Admin dashboard disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist'
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected successfully');

    // Initialize WhatsApp bot
    await initializeWhatsAppBot(io);
    logger.info('WhatsApp bot initialized successfully');

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`🚀 MediPod WhatsApp Bot server running on port ${PORT}`);
      logger.info(`📱 WhatsApp Bot: MediBot is ready to serve!`);
      logger.info(`🩺 Health check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = { app, server, io }; 