const XLSX = require("xlsx");
const db = require("../config/db");

exports.uploadBpt = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    let totalRecordsInserted = 0;
    const CHUNK_SIZE = 5000;
    const buffer = [];

    const toDecimal = (val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const toInt = (val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    };


    for (const file of req.files) {
      const workbook = XLSX.readFile(file.path);

      for (const sheetName of workbook.SheetNames) {
        const data = XLSX.utils.sheet_to_json(
          workbook.Sheets[sheetName],
          { defval: null }
        );

        for (const row of data) {

          buffer.push([
            toInt(row["POS Ref"]),
            toInt(row["Definition Sequence"]),
            toInt(row["Price Number"]),
            row["Standardized Category"] || null,
            row["Menu Item Name"] || null,
            row["Menu Description"] || null,
            toDecimal(row["Average Price"]),
            toDecimal(row["Sales Total"]),
            row["Airport Name"] || null,
            row["Restaurant Name"] || null,
            row["Address"] || null,
            row["Comp Category"] || null,
            row["Competitor Item Name"] || null,
            row["Competitor Description"] || null,
            toDecimal(row["Competitor Price"]),

          ]);
        }
      }
    }

    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Uploaded files are empty",
      });
    }


    const checkSql = `
  SELECT
    \`POS Ref\`,
    \`Airport Name\`,
    \`Restaurant Name\`
  FROM bpt_data
`;

    const [dbRows] = await db.query(checkSql);

    const existingRows = new Set(
      dbRows.map(
        (r) =>
          `${r["POS Ref"]}|${r["Airport Name"]}|${r["Restaurant Name"]}`
      )
    );
    const validInserts = [];
    const duplicatedRecords = [];


    for (const row of buffer) {
      const posRef = row[0];
      const airportName = row[8];
      const restaurantName = row[9];

      const key = `${posRef}|${airportName}|${restaurantName}`;

      if (existingRows.has(key)) {
        duplicatedRecords.push({
          posRef,
          airportName,
          restaurantName,
          reason: "Duplicate record",
        });
      } else {
        validInserts.push(row);
        existingRows.add(key);
      }
    }


    if (validInserts.length > 0) {
      const insertSql = `
  INSERT INTO bpt_data (
    \`POS Ref\`,
    \`Definition Sequence\`,
    \`Price Number\`,
    \`Standardized Category\`,
    \`Menu Item Name\`,
    \`Menu Description\`,
    \`Average Price\`,
    \`Sales Total\`,
    \`Airport Name\`,
    \`Restaurant Name\`,
    \`Address\`,
    \`Comp Category\`,
    \`Competitor Item Name\`,
    \`Competitor Description\`,
    \`Competitor Price\`
  ) VALUES ?
`;

      for (let i = 0; i < validInserts.length; i += CHUNK_SIZE) {
        const chunk = validInserts.slice(i, i + CHUNK_SIZE);

        await db.query(insertSql, [chunk]);

        totalRecordsInserted += chunk.length;
      }
    }

    return res.status(200).json({
      success: true,
      message:
        duplicatedRecords.length > 0
          ? "Data uploaded successfully. Duplicate records skipped."
          : "Data uploaded successfully.",
      filesUploaded: req.files.length,
      totalInserted: totalRecordsInserted,
      duplicateCount: duplicatedRecords.length,
      duplicates: duplicatedRecords,
    });
  } catch (err) {
    console.error("Competitor Pricing Upload Error:", err);

    return res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message,
    });
  }
};

exports.getBptData = async (req, res) => {
  try {
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 10;

    const airportName = req.body.airportName;
    const restaurantName = req.body.restaurantName;
    const search = req.body.search || "";

    const offset = (page - 1) * limit;

    let query = "SELECT * FROM bpt_data";
    let countQuery = "SELECT COUNT(*) as total FROM bpt_data";
    const toatalCountQuery = "SELECT COUNT(*) AS totalCount FROM bpt_data";


    const values = [];
    const conditions = [];

    const searchableColumns = ["`Standardized Category`", "`Menu Item Name`"];


    if (search) {
      const searchCondition = searchableColumns.map(
        col => `${col} LIKE ?`
      );

      conditions.push(`(${searchCondition.join(" OR ")})`);

      searchableColumns.forEach(() => {
        values.push(`%${search}%`);
      });
    }

    if (airportName) {
      conditions.push("`Airport Name` = ?");
      values.push(airportName);
    }


    if (restaurantName) {
      conditions.push(`
    LOWER(REPLACE( REPLACE(\`Restaurant Name\`, ' ', ''),'-', '') ) = ?`);

      values.push(restaurantName.toLowerCase().replace(/[\s-]+/g, ''));
    }
    if (conditions.length > 0) {
      const whereClause = " WHERE " + conditions.join(" AND ");
      query += whereClause;
      countQuery += whereClause;
    }

    // PAGINATION (only for main query)
    query += " LIMIT ? OFFSET ?";
    const queryValues = [...values, limit, offset];

    const [rows] = await db.query(query, queryValues);

    const [count] = await db.query(countQuery, values);
    const [totalCount] = await db.query(toatalCountQuery);


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

exports.getAirportName = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT distinct `Airport Name` FROM `bpt_data` WHERE `Airport Name` IS NOT NULL ORDER BY `Airport Name`"
    );
    const airportName = rows.map(row => row["Airport Name"]);

    res.status(200).json({
      success: true,
      data: airportName,
    })
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

exports.getRestaurantName = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        \`Restaurant Name\`,
        COUNT(*) AS total
      FROM bpt_data
      WHERE \`Restaurant Name\` IS NOT NULL
      GROUP BY \`Restaurant Name\`
      ORDER BY \`Restaurant Name\`
    `);

    const restaurantNames = [
      ...new Set(
        rows.map((row) =>
          row["Restaurant Name"].replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        )
      ),
    ].sort();

    res.status(200).json({
      success: true,
      data: restaurantNames,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSeperateRestaurantCount = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        LOWER(
          REGEXP_REPLACE(\`Restaurant Name\`, '[^a-zA-Z0-9]', '')
        ) AS restaurantName,
        COUNT(*) AS total
      FROM bpt_data
      WHERE \`Restaurant Name\` IS NOT NULL
      GROUP BY restaurantName
      ORDER BY restaurantName
    `);

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};