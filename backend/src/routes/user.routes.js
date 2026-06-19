const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middlewares/auth");

// ====================== USER ROUTES ======================

// GET All Users (Admin only)
router.get("/", verifyToken, userController.getAllUsers);

// Module access request workflow
router.post("/access-request", verifyToken, userController.requestModuleAccess);
router.get("/access-requests", verifyToken, userController.getModuleAccessRequests);
router.patch("/access-requests/:id", verifyToken, userController.reviewModuleAccessRequest);

// GET Single User by ID
router.get("/:id", verifyToken, userController.getUserById);

// CREATE New User (Admin only)
router.post("/", verifyToken, userController.createUser);

// UPDATE User
router.put("/:id", verifyToken, userController.updateUser);

// UPDATE User Rights (Admin only)
router.patch("/:id/rights", verifyToken, userController.updateUserRights);

// DELETE User (Admin only)
router.delete("/:id", verifyToken, userController.deleteUser);

// Generate new password (Admin only)
router.post("/:id/generate-password", verifyToken, userController.generateUserPassword);

module.exports = router;
