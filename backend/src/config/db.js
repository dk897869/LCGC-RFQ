const mongoose = require("mongoose");

mongoose.set("bufferCommands", false);

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      console.warn("MongoDB URI missing. API server will run, but database routes will return fast errors.");
      return false;
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    console.log("MongoDB Connected");
    return true;
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    console.warn("API server kept alive. Check Atlas network access/DNS or MONGO_URI, then restart when fixed.");
    return false;
  }
};

module.exports = connectDB;
