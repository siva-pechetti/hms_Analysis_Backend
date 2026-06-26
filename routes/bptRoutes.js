const router = require("express").Router();
const upload = require("../middleware/upload");
const {uploadBpt, getBptData, getAirportName, getRestaurantName, getSeperateRestaurantCount} =require("../controllers/bpt");

router.post("/upload",upload.array("files",500),uploadBpt);

router.post("/bptData",getBptData)
router.get("/airportName",getAirportName);
router.get("/restaurantName",getRestaurantName);
router.get("/seperateRestaurantCount",getSeperateRestaurantCount);
module.exports = router;