// scripts/seedData.js
const mongoose = require("mongoose");
const Part = require("../models/part");
const Vendor = require("../models/vendor");
const Request = require("../models/request");
require("dotenv").config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await Part.deleteMany({});
    await Vendor.deleteMany({});
    await Request.deleteMany({});

    // Create sample parts
    const parts = await Part.insertMany([
      {
        partCode: "PART-001",
        description: "Motor Assembly Unit",
        price: 12500,
        quantity: 50,
        location: "Warehouse A",
        category: "Electrical",
        manufacturer: "PPLM Industries",
        status: "Active"
      },
      {
        partCode: "PART-002",
        description: "Control Circuit Board",
        price: 3450,
        quantity: 120,
        location: "Warehouse B",
        category: "Electronics",
        manufacturer: "Tech Solutions",
        status: "Active"
      }
    ]);

    // Create sample vendors
    const vendors = await Vendor.insertMany([
      {
        name: "PPLM Industries",
        email: "contact@pplmindustries.com",
        phone: "+91 98765 43210",
        company: "PPLM Industries Pvt Ltd",
        gst: "27AABCP1234E1Z5",
        address: "Mumbai, Maharashtra",
        status: "Active"
      },
      {
        name: "Tech Solutions Ltd",
        email: "sales@techsolutions.com",
        phone: "+91 87654 32109",
        company: "Tech Solutions Limited",
        gst: "29AAACT1234E1Z2",
        address: "Bangalore, Karnataka",
        status: "Active"
      }
    ]);

    // Create sample requests
    const requests = await Request.insertMany([
      {
        requester: "Chandra Shekhar",
        department: "Purchase",
        title: "Operational Support and Action plan",
        amount: 2550000,
        vendor: "PPLM Industries",
        priority: "High",
        status: "Pending",
        description: "Cash-flow constraints due to decreased production volumes",
        date: "23-Feb-26"
      },
      {
        requester: "Rajesh Kumar",
        department: "Finance",
        title: "Vendor Payment Clearance",
        amount: 1250000,
        vendor: "Tech Solutions Ltd",
        priority: "Medium",
        status: "Approved",
        description: "Outstanding payments for IT infrastructure",
        date: "20-Feb-26"
      }
    ]);

    console.log("✅ Data seeded successfully!");
    console.log(`- ${parts.length} parts created`);
    console.log(`- ${vendors.length} vendors created`);
    console.log(`- ${requests.length} requests created`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();