const mongoose = require("mongoose");

// ✅ Enable bufferCommands to allow lazy connection
mongoose.set("bufferCommands", true);

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.warn("⚠️ MongoDB URI missing. API server will run, but database routes will return fast errors.");
      return false;
    }

    console.log(`📡 Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      // ✅ Enable autoIndex for development
      autoIndex: true
    });
    
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🔢 Connection State: ${mongoose.connection.readyState}`);
    
    return true;
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    console.warn("⚠️ API server kept alive. Check Atlas network access/DNS or MONGO_URI, then restart when fixed.");
    return false;
  }
};

// ✅ Add connection event listeners
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB');
});

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('📌 Mongoose connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;