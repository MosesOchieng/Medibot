const twilio = require('twilio');

// Initialize Twilio client with environment variables
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function testWhatsAppMessage() {
  try {
    console.log('📱 Testing WhatsApp message...');
    
    // Test 1: Regular message
    const regularMessage = await client.messages.create({
      body: 'Hello from MediPod Africa! 🩺',
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+254745092523'
    });
    
    console.log('✅ Regular message sent:', regularMessage.sid);
    
    // Test 2: Template message using ContentSid (like your curl example)
    const templateMessage = await client.messages.create({
      contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
      contentVariables: JSON.stringify({
        "1": "12/1",
        "2": "3pm"
      }),
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+254745092523'
    });
    
    console.log('✅ Template message sent:', templateMessage.sid);
    
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    
    if (error.code === 20003) {
      console.log('💡 Authentication failed. Please check your TWILIO_AUTH_TOKEN.');
    } else if (error.code === 21211) {
      console.log('💡 Invalid phone number format.');
    } else if (error.code === 21608) {
      console.log('💡 ContentSid not found or invalid.');
    }
  }
}

// Run the test
testWhatsAppMessage(); 