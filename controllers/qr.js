const XLSX = require("xlsx");
const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const CHUNK_SIZE = 5000;

/**
 * Safe number conversion helpers
 */
const toIntOrNull = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.trunc(n);
};

const toDecimalOrNull = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
};

exports.uploadQr = async (req, res) => {
  try {
    console.log("req.files =", req.files);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const batchId = uuidv4();
    let totalRecordsInserted = 0;
    const CHUNK_SIZE = 5000;
    const buffer = [];

    // Helper formatting guard parameters
    const toDecimalOrNull = (val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const toIntOrNull = (val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    };

    // 1. Read files and accumulate all source records into a single dataset array
    for (const file of req.files) {
      const workbook = XLSX.readFile(file.path);

      for (const sheetName of workbook.SheetNames) {
        const data = XLSX.utils.sheet_to_json(
          workbook.Sheets[sheetName],
          { defval: null }
        );

        for (const row of data) {
          buffer.push([
            row.AIRPORT_CODE ? String(row.AIRPORT_CODE).trim() : null,
            row.DEPARTMENT_ID ? String(row.DEPARTMENT_ID).trim() : null,
            toIntOrNull(row.RVC_NUMBER),
            row.PROPERTY_NAME || null,
            row.CITY || null,
            row.POS_MENU_ITEM_ID ? String(row.POS_MENU_ITEM_ID).trim() : null,
            row.HMSHOST_POS_MENU_NAME || null,
            row.POS_MENU_DESCRIPTION || null,
            toDecimalOrNull(row.POS_PRICE),
            row.POS_CATEGORY_ID ? String(row.POS_CATEGORY_ID).trim() : null,
            row.POS_SUBCATEGORY_ID || null,
            toIntOrNull(row.CALORIES),
          ]);
        }
      }
    }

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, message: "Uploaded datasets are empty." });
    }

    // 2. Extract constraint values from database targets to detect collisions
    const checkSql = `
      SELECT AIRPORT_CODE, DEPARTMENT_ID, RVC_NUMBER, POS_MENU_ITEM_ID, POS_CATEGORY_ID 
      FROM qr_data
    `;
    const [dbRows] = await db.query(checkSql);

    // Build unique look-up signature Set mapping values: "AIRPORT|DEPT|RVC|ITEM|CATEGORY"
    const existingRows = new Set(
      dbRows.map(r => {
        const apt = r.AIRPORT_CODE ? String(r.AIRPORT_CODE).trim() : "";
        const dept = r.DEPARTMENT_ID ? String(r.DEPARTMENT_ID).trim() : "";
        const rvc = r.RVC_NUMBER !== null ? String(r.RVC_NUMBER).trim() : "";
        const item = r.POS_MENU_ITEM_ID ? String(r.POS_MENU_ITEM_ID).trim() : "";
        const cat = r.POS_CATEGORY_ID ? String(r.POS_CATEGORY_ID).trim() : "";
        return `${apt}|${dept}|${rvc}|${item}|${cat}`;
      })
    );

    const validInserts = [];
    const duplicatedRecords = [];

    // 3. Separate structural duplicates from compliant transactional units
    for (const row of buffer) {
      const airportCode = row[0] || "";
      const deptId = row[1] || "";
      const rvcNum = row[2] !== null ? String(row[2]) : "";
      const menuItemId = row[5] || "";
      const menuItemName = row[6] || "Unknown Item";
      const categoryId = row[9] || "";

      const key = `${airportCode}|${deptId}|${rvcNum}|${menuItemId}|${categoryId}`;

      if (existingRows.has(key)) {
        duplicatedRecords.push({
          airportCode: airportCode || "N/A",
          departmentId: deptId || "N/A",
          rvcNumber: rvcNum || "N/A",
          menuItemId,
          menuItemName,
          categoryId: categoryId || "N/A",
          reason: "Identical metrics detected across data keys"
        });
      } else {
        validInserts.push(row);
        // Add to active Set to ensure file-internal repetitions are caught instantly
        existingRows.add(key);
      }
    }

    // 4. Batch transaction arrays inside chunks to safe bounds
    if (validInserts.length > 0) {
      const insertSql = `
        INSERT INTO qr_data (
          AIRPORT_CODE, DEPARTMENT_ID, RVC_NUMBER, PROPERTY_NAME, CITY,
          POS_MENU_ITEM_ID, HMSHOST_POS_MENU_NAME, POS_MENU_DESCRIPTION,
          POS_PRICE, POS_CATEGORY_ID, POS_SUBCATEGORY_ID, CALORIES
        ) VALUES ?
      `;

      for (let i = 0; i < validInserts.length; i += CHUNK_SIZE) {
        const chunk = validInserts.slice(i, i + CHUNK_SIZE);
        await db.query(insertSql, [chunk]);
        totalRecordsInserted += chunk.length;
      }
    }


    // 6. Return response containing structured success indicators and duplicate maps
    return res.status(200).json({
      success: true,
      batchId,
      message: duplicatedRecords.length > 0
        ? "Partial completion: Unique items processed, duplicate signatures bypassed."
        : "Dataset successfully integrated into primary records.",
      filesUploaded: req.files.length,
      totalInserted: totalRecordsInserted,
      duplicateCount: duplicatedRecords.length,
      duplicates: duplicatedRecords
    });

  } catch (err) {
    console.error("QR Upload Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

exports.getQr = async (req, res) => {
  try {

    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 10;

    const airportCode = req.body.airportCode;
    const posCategoryId = req.body.posCategoryId;
    const { search = "" } = req.body;

    let offset = (page - 1) * limit;

    let query = "SELECT * FROM qr_data";
    let countQuery = "select count(*) as total from qr_data";
    const toatalCountQuery = "SELECT COUNT(*) AS totalCount FROM qr_data";

    const values = [];
    const conditions = [];
    if (search.trim()) {
      const searchableColumns = [
        "POS_MENU_ITEM_ID",
        "HMSHOST_POS_MENU_NAME",
      ];

      const searchConditions = searchableColumns.map(
        (col) => `${col} LIKE ?`
      );

      conditions.push(`(${searchConditions.join(" OR ")})`);

      searchableColumns.forEach(() => {
        values.push(`%${search}%`);
      });
    }

    if (airportCode) {
      conditions.push(" AIRPORT_CODE = ? ");

      values.push(airportCode);
    }

    if (posCategoryId) {
      conditions.push(" POS_CATEGORY_ID= ? ");
      values.push(posCategoryId);
    }

    if (conditions.length > 0) {
      const whereClause = " where " + conditions.join(" AND ");
      query += whereClause;
      countQuery += whereClause;
    }

    query += " LIMIT ? offset ?";


    const [rows] = await db.query(query, [...values, limit, offset]);
    const [count] = await db.query(countQuery, values);
    const [totalCount] = await db.query(toatalCountQuery);


    console.log("response", rows)

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

exports.getAirportCodes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT AIRPORT_CODE, COUNT(*) AS total
      FROM qr_data
      GROUP BY AIRPORT_CODE
      ORDER BY AIRPORT_CODE
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
exports.getPosCategoryId = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT POS_CATEGORY_ID FROM qr_data where POS_CATEGORY_ID is not null ORDER BY POS_CATEGORY_ID"
    );
    const PosCategoryId = rows.map(
      row => row.POS_CATEGORY_ID
    );

    res.status(200).json({
      success: true,
      data: PosCategoryId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


