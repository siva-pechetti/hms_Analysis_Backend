const router = require("express").Router();
const upload = require("../middleware/upload");
const { uploadSnowflake,getSnowflakeData,getBusinessUnits, getFamilyGroupName, getProductGroupId, getConceptId, getMajorGroupId, getBusinessUnitCount} = require("../controllers/snowFlake");

router.post("/upload", upload.array("files",500), uploadSnowflake);


router.post("/snowflake-data", getSnowflakeData);
router.get("/business-units", getBusinessUnits);
router.get("/family-data",getFamilyGroupName);
router.get("/product-data",getProductGroupId);
router.get("/conceptId",getConceptId);
router.get("/majorGroupId",getMajorGroupId);

router.get("/seperateBussinessCount",getBusinessUnitCount);
module.exports = router;