const router = require("express").Router();
const upload = require("../middleware/upload");
const {
  uploadQr,
  getQr,
  getAirportCodes,getPosCategoryId
} = require("../controllers/qr");

router.post("/upload", upload.array("files", 500), uploadQr);
router.post("/data", getQr);
router.get("/airportcode", getAirportCodes);
router.get("/posCategoryID",getPosCategoryId);

module.exports = router;