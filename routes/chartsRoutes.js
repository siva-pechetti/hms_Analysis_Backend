const router = require("express").Router();
const upload = require("../middleware/upload");
const {getComparationBarChart} = require("../controllers/charts");
 
router.post("/graphs",getComparationBarChart);
module.exports = router;