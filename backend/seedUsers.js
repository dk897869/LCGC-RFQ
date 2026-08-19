const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

const User = require('./src/models/user.model'); // Adjust path if needed

const seedData = [
  {
    employeeId: '100845',
    name: 'Manoj',
    email: 'parasharvijaydeep@yahoo.com',
    password: '123456',
    role: 'User',
    contactNo: '8807900000',
    department: 'Store',
    organization: 'Radiant',
    designation: 'Engineer'
  },
  {
    employeeId: '100846',
    name: 'Depak',
    email: 'parasharvijaydeep@gmail.com',
    password: '123456',
    role: 'User',
    contactNo: '8807900000',
    department: 'Purchase',
    organization: 'Radiant',
    designation: 'Engineer'
  },
  {
    employeeId: '100847',
    name: 'Vijay Deep Parashar',
    email: 'vijay.parashar@radiantappliances.com',
    password: '123456',
    role: 'Purchase Head',
    contactNo: '8807900000',
    department: 'Purchase',
    organization: 'Radiant',
    designation: 'Head - Purchase'
  },
  {
    name: 'Rajeev Jha',
    email: 'contact@vdpnexus.com',
    password: '123456',
    role: 'VP',
    contactNo: '8807900000',
    department: 'Plant Head',
    organization: 'VDP Nexus',
    designation: 'VP-Operation'
  },
  {
    name: 'Rajesh',
    email: 'vijay.parashar@vdp.ltd',
    password: '123456',
    role: 'Vendor',
    contactNo: '',
    department: '',
    organization: 'VDP PTV LTD',
    designation: 'Supplier 1'
  },
  {
    name: 'Deepak',
    email: 'dk897869@gmail.com',
    password: '123456',
    role: 'Vendor',
    contactNo: '',
    department: '',
    organization: 'Deepak Ind.',
    designation: 'Supplier 2'
  },
  {
    name: 'Mohan Lal',
    email: 'dk7314330@gmail.com',
    password: '123456',
    role: 'Vendor',
    contactNo: '',
    department: '',
    organization: 'Mohan Ind.',
    designation: 'Supplier 3'
  }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/lcgc-rfq', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to DB');
    for (const data of seedData) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);

      const exists = await User.findOne({ email: data.email });
      if (!exists) {
        await User.create({ ...data, password: hashedPassword });
        console.log(`Created user: ${data.email} (${data.designation})`);
      } else {
        console.log(`User already exists: ${data.email}, updating role/designation/password...`);
        await User.updateOne({ email: data.email }, { 
          $set: { 
            name: data.name,
            password: hashedPassword,
            role: data.role, 
            designation: data.designation,
            organization: data.organization,
            department: data.department,
            contactNo: data.contactNo,
            employeeId: data.employeeId || ''
          } 
        });
      }
    }
    console.log('Seeding complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
