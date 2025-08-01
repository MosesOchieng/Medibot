const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define format for file logs (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: format,
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: fileFormat,
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: fileFormat,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging middleware
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Add custom methods for structured logging
logger.logBooking = (bookingData) => {
  logger.info('📋 Booking created', {
    bookingId: bookingData.id,
    phone: bookingData.phone,
    service: bookingData.service_type,
    amount: bookingData.total_fee,
    location: bookingData.location
  });
};

logger.logPayment = (paymentData) => {
  logger.info('💰 Payment processed', {
    paymentId: paymentData.id,
    method: paymentData.method,
    amount: paymentData.amount,
    status: paymentData.status,
    reference: paymentData.reference
  });
};

logger.logWhatsAppMessage = (direction, phone, message) => {
  const emoji = direction === 'incoming' ? '📱' : '📤';
  logger.info(`${emoji} WhatsApp ${direction} message`, {
    phone: phone,
    message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    timestamp: new Date().toISOString()
  });
};

logger.logError = (error, context = {}) => {
  logger.error('❌ Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

logger.logVehicleAssignment = (vehicleId, bookingId, location) => {
  logger.info('🚐 Vehicle assigned', {
    vehicleId: vehicleId,
    bookingId: bookingId,
    location: location,
    timestamp: new Date().toISOString()
  });
};

logger.logNotification = (type, phone, status) => {
  logger.info('📢 Notification sent', {
    type: type,
    phone: phone,
    status: status,
    timestamp: new Date().toISOString()
  });
};

// Export the logger
module.exports = logger; 