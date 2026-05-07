const express = require("express");
const router = express.Router();

const partController = require("../controllers/part.controller");
const { verifyToken } = require("../middlewares/auth");

// ====================== FULL CRUD ======================

// GET All Parts
router.get("/", verifyToken, partController.getParts);

// GET Single Part by ID
router.get("/:id", verifyToken, partController.getPartById);

// CREATE New Part
router.post("/", verifyToken, partController.addPart);

// UPDATE Part (Full Update)
router.put("/:id", verifyToken, partController.updatePart);

// PATCH - Update Part Status
router.patch("/:id/status", verifyToken, partController.updatePartStatus);

// DELETE Part
router.delete("/:id", verifyToken, partController.deletePart);

module.exports = router;