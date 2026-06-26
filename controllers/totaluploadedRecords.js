
const XLSX = require("xlsx");
const db = require("../config/db");


exports.records = async (req, res) => {
  try {
    const pairs = [
      { key: "margaritavillerestaurants", value: "AME" },
      { key: "auntieannes", value: "AAP" },
      { key: "blazepizza", value: "BPA" },
      { key: "burgerking", value: "BKG" },
      { key: "carrabbas", value: "CAS" },
      { key: "chickfila", value: "CFA" },
      { key: "chilis", value: "CHI" },
      { key: "cinnabon", value: "CIN" },
      { key: "dunkin", value: "DDS" },
      { key: "firehousesubs", value: "FHS" },
      { key: "jimmyjohns", value: "JYJ" },
      { key: "longhornsteakhouse", value: "LSE" },
      { key: "maggianos", value: "MAG" },
      { key: "outbacksteakhouse", value: "OUT" },
      { key: "pandaexpress", value: "PES" },
      { key: "popeyes", value: "POP" },
      { key: "shakeshack", value: "SSA" },
      { key: "smashburger", value: "SMA" },
    ];

    const restaurantName =
      req.query.restaurantName &&
        req.query.restaurantName !== "null" &&
        req.query.restaurantName !== "undefined"
        ? req.query.restaurantName.trim()
        : null;
    const airportName = req.query.airportName && req.query.airportName !== "null" && req.query.airportName !== "undefined" ? req.query.airportName.trim() : null;


    // Snowflake
    let snowflakeQuery =
      "SELECT COUNT(*) AS count FROM snowflake_data";
    let queryParams = [];
    let snowflakeConditions = [];

    if (restaurantName) {
      const normalizedRestaurantName = restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      const pair = pairs.find(
        (p) => p.key === normalizedRestaurantName
      );

      if (pair) {
        snowflakeConditions.push("CONCEPT_ID = ?");
        queryParams.push(pair.value);
      }
    }

    if (airportName) {
      snowflakeConditions.push("BUSINESS_UNIT_NAME = ?");
      queryParams.push(airportName);
    }

    if (snowflakeConditions.length) {
      snowflakeQuery +=
        " WHERE " + snowflakeConditions.join(" AND ");
    }
    console.log("Snowflake:", snowflakeQuery, queryParams);
    const [sCount] = await db.query(
      snowflakeQuery,
      queryParams
    );

    const [qCount] = await db.query(
      "SELECT COUNT(*) AS count FROM qr_data"
    );

    // BPT
    let bptQuery =
      "SELECT COUNT(*) AS count FROM bpt_data";
    let bptParams = [];
    let bptConditions = [];

    if (restaurantName) {
      bptConditions.push("LOWER(REPLACE(`Restaurant Name`, '''', '')) = ?");
      bptParams.push(
        restaurantName.toLowerCase()
      );
    }

    if (airportName) {
      bptConditions.push("`Airport Name` = ?");
      bptParams.push(airportName);
    }

    if (bptConditions.length) {
      bptQuery +=
        " WHERE " + bptConditions.join(" AND ");
    }
    console.log("BPT:", bptQuery, bptParams);
    const [bCount] = await db.query(
      bptQuery,
      bptParams
    );
    res.status(200).json({
      success: true,
      snowflakeCount: sCount[0].count,
      qrCount: qCount[0].count,
      bptCount: bCount[0].count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};