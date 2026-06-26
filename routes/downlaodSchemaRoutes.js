const router = require("express").Router();
const upload = require("../middleware/upload");
const {downloadSnoflakeSchema} =require("../controllers/downloadSchema");

router.get("/downloadSnowflakeSchema",downloadSnoflakeSchema);

module.exports= router;