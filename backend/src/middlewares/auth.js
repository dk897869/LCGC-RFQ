const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user.model');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (mongoose.connection.readyState !== 1) {
      req.user = {
        id: decoded.id,
        _id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'Admin',
        name: decoded.name || decoded.email || 'User',
        rights: decoded.rights || {}
      };
      return next();
    }

    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error?.name && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable. Please retry after the server reconnects.'
      });
    }
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

module.exports = { verifyToken };
