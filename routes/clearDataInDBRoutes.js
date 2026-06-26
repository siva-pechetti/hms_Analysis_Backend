const router = require("express").Router();
const upload = require("../middleware/upload");
const {deleteBPTDataInDB, deleteQRDataInDB, deleteSnowflakeDataInDB}= require("../controllers/clearDataInDB");

router.delete("/deleteBPTData",deleteBPTDataInDB);
router.delete("/deleteQRData",deleteQRDataInDB);
router.delete("/deleteSnowflakeData",deleteSnowflakeDataInDB);
module.exports=router;