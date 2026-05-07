const express = require("express");
const router = express.Router();

const vendorController = require("../controllers/vendor.controller");
const { verifyToken } = require("../middlewares/auth");

// ====================== FULL CRUD ======================

// GET All Vendors
router.get("/", verifyToken, vendorController.getVendors);

// GET Single Vendor by ID
router.get("/:id", verifyToken, vendorController.getVendorById);

// CREATE New Vendor
router.post("/", verifyToken, vendorController.addVendor);

// UPDATE Vendor (Full Update)
router.put("/:id", verifyToken, vendorController.updateVendor);

// PATCH - Update Vendor Status
router.patch("/:id/status", verifyToken, vendorController.updateVendorStatus);

// DELETE Vendor
router.delete("/:id", verifyToken, vendorController.deleteVendor);

module.exports = router;