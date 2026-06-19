// test-db.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

console.log('🔍 Testing MongoDB connection...');

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env file');
  process.exit(1);
}

// Mask the password for logging
const maskedUri = MONGO_URI.replace(/\/\/.*@/, '//<credentials>@');
console.log(`📡 URI: ${maskedUri}`);

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully!');
  console.log(`📊 Database: ${mongoose.connection.name}`);
  console.log(`🔢 Connection State: ${mongoose.connection.readyState}`);
  console.log(`🌐 Host: ${mongoose.connection.host}`);
  process.exit(0);
})
.catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  console.error('🔑 Please check your username and password in the connection string.');
  console.error('💡 Go to MongoDB Atlas > Database Access > Edit User > Reset Password');
  process.exit(1);
});