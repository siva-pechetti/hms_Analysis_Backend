const router = require("express").Router();
const { records } = require("../controllers/totaluploadedRecords");

router.get("/totalRecords", records);

module.exports = router;