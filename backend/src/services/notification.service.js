const Notification = require('../models/notification.model');

const createNotification = async (userEmail, title, message, type) => {
  try {
    if (!userEmail) return null;
    
    // Normalize email
    const email = userEmail.toLowerCase().trim();
    
    const notif = await Notification.create({
      userEmail: email,
      title: title || 'Notification',
      message: message || '',
      type: type || 'system',
      isRead: false
    });
    
    console.log(`🔔 Notification created in database for ${email}: ${title}`);
    return notif;
  } catch (err) {
    console.error('⚠️ Error creating database notification:', err.message);
    return null;
  }
};

module.exports = { createNotification };
