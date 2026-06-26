const XLSX = require("xlsx");
const db = require("../config/db");

exports.getMatchedData = async (req, res) => {
  try {
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const offset = (page - 1) * limit;


    const businessUnitName = req.body.businessUnitName || null;
    const familyGroupName = req.body.familyGroupName || null;
    const productGroupId = req.body.productGroupId || null;
    const { search = "" } = req.body;

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

    const restaurantName = req.body.restaurantName;

    if (!restaurantName) {
      return res.status(200).json({
        success: true,
        data: [],
        totalSelectedCount: 0,
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    const normalizedRestaurant = restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const pair = pairs.find(
      (p) => p.key === normalizedRestaurant
    );

    if (!pair) {
      return res.status(400).json({
        success: false,
        message: `Restaurant not mapped: ${restaurantName}`,
      });
    }
    const conceptId = pair.value;

    let conditions = [];
    let values = [];

    conditions.push("s.CONCEPT_ID = ?");
    values.push(conceptId);

    if (restaurantName) {
      conditions.push(`
        REGEXP_REPLACE(
          LOWER(b.\`Restaurant Name\`),
          '[^a-z0-9]',
          ''
        ) = REGEXP_REPLACE(
          LOWER(?),
          '[^a-z0-9]',
          ''
        )
      `);
      values.push(restaurantName);
    }

    if (businessUnitName) {
      conditions.push("s.BUSINESS_UNIT_NAME = ?");
      values.push(businessUnitName);
    }

    if (search && search.trim() !== "") {
      const searchValue = `%${search.trim().toLowerCase()}%`;

      conditions.push(`(
        CAST(s.MENU_ITEM_ID AS CHAR) LIKE ?
        OR LOWER(s.MENU_ITEM_NAME) LIKE ?
      )`);

      values.push(searchValue, searchValue);
    }

    let groupConditions = [];

    if (Array.isArray(familyGroupName) && familyGroupName.length > 0) {
      const placeholders = familyGroupName.map(() => "?").join(", ");
      groupConditions.push(`s.FAMILY_GROUP_NAME IN (${placeholders})`);
      values.push(...familyGroupName);
    }

    if (Array.isArray(productGroupId) && productGroupId.length > 0) {
      const placeholders = productGroupId.map(() => "?").join(", ");
      groupConditions.push(`s.PRODUCT_GROUP_ID IN (${placeholders})`);
      values.push(...productGroupId);
    }

    if (groupConditions.length > 0) {
      conditions.push(`(${groupConditions.join(" OR ")})`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      WITH ranked AS (
        SELECT 
          s.BUSINESS_UNIT_NAME,
          b.\`Menu Item Name\` AS bpt_menu_item_name,
          s.MENU_ITEM_ID,
          s.MENU_ITEM_NAME,
          s.MAJOR_GROUP_ID,
          s.FAMILY_GROUP_NAME,
          s.PRODUCT_GROUP_ID,
          ROW_NUMBER() OVER (
            PARTITION BY b.\`POS Ref\`
            ORDER BY s.MENU_ITEM_ID
          ) AS rn
        FROM auth_db.bpt_data b
        INNER JOIN auth_db.snowflake_data s
          ON s.MENU_ITEM_ID = b.\`POS Ref\`
        ${whereClause}
      )
      SELECT *
      FROM ranked
      WHERE rn = 1
      LIMIT ? OFFSET ?;
    `;

    const countQuery = `
      WITH ranked AS (
        SELECT 
          b.\`POS Ref\`,
          ROW_NUMBER() OVER (
            PARTITION BY b.\`POS Ref\`
            ORDER BY s.MENU_ITEM_ID
          ) AS rn
        FROM auth_db.bpt_data b
        INNER JOIN auth_db.snowflake_data s
          ON s.MENU_ITEM_ID = b.\`POS Ref\`
        ${whereClause}
      )
      SELECT COUNT(*) AS total
      FROM ranked
      WHERE rn = 1;
    `;

    const totalCountQuery = `
      SELECT COUNT(DISTINCT b.\`POS Ref\`) AS totalCount
      FROM auth_db.bpt_data b
      INNER JOIN auth_db.snowflake_data s
        ON s.MENU_ITEM_ID = b.\`POS Ref\`
      WHERE s.CONCEPT_ID = ?
        AND REGEXP_REPLACE(
          LOWER(b.\`Restaurant Name\`),
          '[^a-z0-9]',
          ''
        ) = REGEXP_REPLACE(
          LOWER(?),
          '[^a-z0-9]',
          ''
        );
    `;

    const [rows] = await db.query(query, [...values, limit, offset]);
    const [count] = await db.query(countQuery, values);
    const [totalCount] = await db.query(totalCountQuery, [conceptId, restaurantName]);

    res.status(200).json({
      success: true,
      data: rows,
      totalSelectedCount: count[0].total,
      total: totalCount[0].totalCount,
      page,
      limit,
      totalPages: Math.ceil(count[0].total / limit),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAirportNames = async (req, res) => {
  try {
    const { restaurantName } = req.query;
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

    const pair = pairs.find((p) => p.key === restaurantName?.toLowerCase());

    if (!pair) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant name",
      });
    }


    const conceptId = pair.value;

    const sql = `
      SELECT DISTINCT BUSINESS_UNIT_NAME
      FROM snowflake_data
      WHERE CONCEPT_ID = ?
    `;

    const [rows] = await db.query(sql, [conceptId]);

    const businessUnitName = rows.map(row => row.BUSINESS_UNIT_NAME);

    res.status(200).json({
      success: true,
      data: businessUnitName,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getUnMatchedData = async (req, res) => {
  try {
    const page = parseInt(req.body.page, 10) || 1;
    const limit = parseInt(req.body.limit, 10) || 10;
    const search = req.body.search?.trim() || "";


    const offset = (page - 1) * limit;

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


    const restaurantName = req.body.restaurantName;

    if (!restaurantName) {
      return res.status(200).json({
        success: true,
        data: [],
        totalSelectedCount: 0,
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    const normalizedRestaurant = restaurantName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const pair = pairs.find(
      (p) => p.key === normalizedRestaurant
    );

    if (!pair) {
      return res.status(400).json({
        success: false,
        message: `Restaurant not mapped: ${restaurantName}`,
      });
    }

    const conceptId = pair.value;

    const conditions = [];
    const values = [];
    if (restaurantName) {
      conditions.push(`
        REGEXP_REPLACE(
          LOWER(b.\`Restaurant Name\`),
          '[^a-z0-9]',
          ''
        ) = REGEXP_REPLACE(
          LOWER(?),
          '[^a-z0-9]',
          ''
        )
      `);
      values.push(restaurantName);
    }
    if (search !== "") {
      const searchValue = `%${search.toLowerCase()}%`;

      conditions.push(`(
        LOWER(CAST(b.\`POS Ref\` AS CHAR)) LIKE ?
        OR LOWER(b.\`Menu Item Name\`) LIKE ?
      )`);

      values.push(searchValue, searchValue);
    }

    const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

    const query = `
      SELECT b.*
      FROM auth_db.bpt_data b
      LEFT JOIN auth_db.snowflake_data s
        ON s.MENU_ITEM_ID = b.\`POS Ref\`
        AND s.CONCEPT_ID = ?
      WHERE s.MENU_ITEM_ID IS NULL
        AND ${whereClause}
      LIMIT ? OFFSET ?;
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM auth_db.bpt_data b
      LEFT JOIN auth_db.snowflake_data s
        ON s.MENU_ITEM_ID = b.\`POS Ref\`
        AND s.CONCEPT_ID = ?
      WHERE s.MENU_ITEM_ID IS NULL
        AND ${whereClause};
    `;

    const [rows] = await db.query(query, [conceptId, ...values, limit, offset]);
    const [count] = await db.query(countQuery, [conceptId, ...values]);

    return res.status(200).json({
      success: true,
      data: rows,
      total: count[0].total,
      page,
      limit,
      totalPages: Math.ceil(count[0].total / limit),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


