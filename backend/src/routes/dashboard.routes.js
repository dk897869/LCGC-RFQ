const router = require("express").Router();
const {verifyToken} = require("../middlewares/auth");
const ctrl = require("../controllers/dashboard.controller");

router.get("/",verifyToken,ctrl.getDashboard);

module.exports = router;