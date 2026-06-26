const db = require("../config/db");

exports.deleteBPTDataInDB = async (req, res) => {
  try {
    const restaurantNames =
      req.body.restaurantNames || [];

    if (
      !Array.isArray(restaurantNames) ||
      restaurantNames.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "No restaurants selected",
      });
    }

    await Promise.all(
      restaurantNames.map((restaurant) => {
        const query = `
          DELETE FROM bpt_data
          WHERE REGEXP_REPLACE(
            LOWER(\`Restaurant Name\`),
            '[^a-z0-9]',
            ''
          ) = ?
        `;

        return db.query(query, [
          restaurant.toLowerCase(),
        ]);
      })
    );

    return res.status(200).json({
      success: true,
      message: "Deleted successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.deleteQRDataInDB = async (req, res) => {
  try {
    let airportNames = req.body.airportName;

    // normalize input
    if (!airportNames) {
      return res.status(400).json({ message: "airportName is required" });
    }

    if (!Array.isArray(airportNames)) {
      airportNames = [airportNames];
    }

    airportNames = airportNames
      .map((name) => name?.trim())
      .filter(Boolean);

    if (airportNames.length === 0) {
      return res.status(400).json({ message: "No valid airport codes" });
    }

    const query = `
      DELETE FROM qr_data
      WHERE AIRPORT_CODE IN (?)
    `;

    await db.query(query, [airportNames]);

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.deleteSnowflakeDataInDB = async (req, res) => {
  try {
    let businessUnits = req.body.businessunit;

    // normalize input
    if (!businessUnits) {
      return res.status(400).json({ message: "businessUnit is required" });
    }

    if (!Array.isArray(businessUnits)) {
      businessUnits = [businessUnits];
    }

    businessUnits = businessUnits
      .map((name) => name?.trim())
      .filter(Boolean);

    if (businessUnits.length === 0) {
      return res.status(400).json({ message: "No valid business unit name codes" });
    }

    const query = `
      DELETE FROM snowflake_data
      WHERE BUSINESS_UNIT_NAME IN (?)
    `;

    await db.query(query, [businessUnits]);

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

