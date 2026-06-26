const router = require("express").Router();
const upload = require("../middleware/upload");
const {getMatchedData,getUnMatchedData, getAirportNames} = require("../controllers/report");


router.post("/matchedData",getMatchedData);
router.post("/unMatchedData",getUnMatchedData);
router.get("/airportNames",getAirportNames)
module.exports = router;