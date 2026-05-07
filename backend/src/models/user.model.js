const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: { 
    type: String, 
    enum: ['Admin', 'Manager', 'VP', 'GM', 'MD', 'Director', 'AGM', 'User', 'Approver'],
    default: 'User'
  },
  contactNo: { 
    type: String, 
    trim: true, 
    default: ''
  },
  phone: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  department: { 
    type: String, 
    trim: true, 
    default: 'Purchase' 
  },
  designation: { 
    type: String, 
    trim: true, 
    default: '' 
  },
  organization: { 
    type: String, 
    trim: true, 
    default: 'Radiant Appliances' 
  },
  dateOfBirth: { 
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true;
        return value <= new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  profileImage: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  workspaces: {
    type: [String],
    default: []
  },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpire: { type: Date, select: false },
  emailVerified: { 
    type: Boolean, 
    default: false 
  },
  emailVerificationToken: { type: String },
  emailVerificationExpire: { type: Date },
  lastLogin: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // Social Login Fields
  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  twitterId: { type: String, unique: true, sparse: true },
  // User Rights
  rights: {
    epApproval: { type: Boolean, default: false },
    vendors: { type: Boolean, default: false },
    parts: { type: Boolean, default: false },
    rfq: { type: Boolean, default: false },
    userManagement: { type: Boolean, default: false },
    nppProcurement: { type: Boolean, default: false },
    bidding: { type: Boolean, default: false },
    paymentRequest: { type: Boolean, default: false },
    dqms: { type: Boolean, default: false },
    npi: { type: Boolean, default: false },
    systemBom: { type: Boolean, default: false },
    bomForecast: { type: Boolean, default: false },
    priceApproval: { type: Boolean, default: false },
    planStock: { type: Boolean, default: false },
    supplierPerformance: { type: Boolean, default: false },
    vehicularMs: { type: Boolean, default: false }
  }
}, { 
  timestamps: true 
});

// Virtual for age calculation
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual to check if today is birthday
userSchema.virtual('isBirthdayToday').get(function() {
  if (!this.dateOfBirth) return false;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  return today.getMonth() === birthDate.getMonth() && 
         today.getDate() === birthDate.getDate();
});

// Virtual for formatted birthday
userSchema.virtual('birthdayFormatted').get(function() {
  if (!this.dateOfBirth) return null;
  const date = new Date(this.dateOfBirth);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
});

// Virtual for user initials
userSchema.virtual('initials').get(function() {
  if (!this.name) return '';
  return this.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
});

// Virtual for full profile
userSchema.virtual('profile').get(function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    contactNo: this.contactNo,
    organization: this.organization,
    age: this.age,
    isBirthdayToday: this.isBirthdayToday,
    emailVerified: this.emailVerified
  };
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  try {
    // Only hash if password is modified and exists
    if (!this.isModified('password')) {
      return next();
    }
    
    // Check if password is already hashed (starts with $2a$ or $2b$)
    if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
      return next();
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  if (!password || !this.password) return false;
  return await bcrypt.compare(password, this.password);
};

// Update password method (for password reset)
userSchema.methods.updatePassword = async function(newPassword) {
  this.password = newPassword;
  return await this.save();
};

// Check if user has specific right
userSchema.methods.hasRight = function(rightName) {
  return this.rights && this.rights[rightName] === true;
};

// Check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'Admin';
};

// Get user permissions summary
userSchema.methods.getPermissions = function() {
  const permissions = [];
  for (const [key, value] of Object.entries(this.rights)) {
    if (value) {
      permissions.push(key);
    }
  }
  return permissions;
};

// Check if user has social login
userSchema.methods.isSocialLogin = function() {
  return !!(this.googleId || this.facebookId || this.twitterId);
};

// Get social login provider
userSchema.methods.getSocialProvider = function() {
  if (this.googleId) return 'google';
  if (this.facebookId) return 'facebook';
  if (this.twitterId) return 'twitter';
  return null;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by mobile
userSchema.statics.findByMobile = function(mobile) {
  const cleanMobile = mobile.replace(/\D/g, '');
  return this.findOne({ 
    $or: [
      { contactNo: { $regex: cleanMobile + '$', $options: 'i' } },
      { phone: { $regex: cleanMobile + '$', $options: 'i' } }
    ]
  });
};

// Static method to find or create social user
userSchema.statics.findOrCreateSocialUser = async function(provider, profile) {
  const query = {};
  if (provider === 'google') query.googleId = profile.id;
  if (provider === 'facebook') query.facebookId = profile.id;
  if (provider === 'twitter') query.twitterId = profile.id;
  
  let user = await this.findOne({ $or: [query, { email: profile.email.toLowerCase() }] });
  
  if (!user) {
    const randomPassword = require('crypto').randomBytes(20).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    
    user = new this({
      name: profile.name || profile.displayName || profile.email.split('@')[0],
      email: profile.email.toLowerCase(),
      [provider === 'google' ? 'googleId' : provider === 'facebook' ? 'facebookId' : 'twitterId']: profile.id,
      password: hashedPassword,
      emailVerified: true,
      role: 'User',
      profileImage: profile.picture || profile.avatar || '',
      rights: {}
    });
    
    await user.save();
  } else if (!user[provider === 'google' ? 'googleId' : provider === 'facebook' ? 'facebookId' : 'twitterId']) {
    user[provider === 'google' ? 'googleId' : provider === 'facebook' ? 'facebookId' : 'twitterId'] = profile.id;
    if (profile.picture && !user.profileImage) user.profileImage = profile.picture;
    await user.save();
  }
  
  return user;
};

// Static method to get dashboard stats
userSchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  const active = await this.countDocuments({ isActive: true });
  const admin = await this.countDocuments({ role: 'Admin' });
  const manager = await this.countDocuments({ role: 'Manager' });
  const user = await this.countDocuments({ role: 'User' });
  const socialUsers = await this.countDocuments({ 
    $or: [
      { googleId: { $exists: true, $ne: null } },
      { facebookId: { $exists: true, $ne: null } },
      { twitterId: { $exists: true, $ne: null } }
    ]
  });
  
  return { total, active, admin, manager, user, socialUsers };
};

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;