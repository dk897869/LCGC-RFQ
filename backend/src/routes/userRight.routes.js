const express = require("express");
const router = express.Router();
const userRightController = require("../controllers/userRight.controller");
const { verifyToken } = require("../middlewares/auth");

router.get("/", verifyToken, userRightController.getUserRights);
router.post("/", verifyToken, userRightController.createUserRight);
router.put("/:id", verifyToken, userRightController.updateUserRight);
router.delete("/:id", verifyToken, userRightController.deleteUserRight);

module.exports = router;