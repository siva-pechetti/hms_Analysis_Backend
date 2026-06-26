const XLSX = require("xlsx");
const db = require("../config/db");


exports.uploadSnowflake = async (req, res) => {
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

    // 1. Read files and parse data into a unified buffer array
    for (const file of req.files) {
      const workbook = XLSX.readFile(file.path);

      for (const sheetName of workbook.SheetNames) {
        const data = XLSX.utils.sheet_to_json(
          workbook.Sheets[sheetName],
          { defval: null }
        );

        for (const row of data) {
          buffer.push([
            toInt(row.FISCAL_YEAR),
            toInt(row.PERIOD_NUM),
            row.BUSINESS_UNIT_NAME ? String(row.BUSINESS_UNIT_NAME).trim() : null,
            row.DEPT_ID || null,
            toInt(row.MICROS_LOC_NUM),
            toInt(row.RVC_NUM),
            toInt(row.MENU_ITEM_ID),
            row.MENU_ITEM_NAME || null,
            toInt(row.DEFSEQ),
            row.CONCEPT_ID ? String(row.CONCEPT_ID).trim() : null,
            row.BRAND_CODE || null,
            row.DEPARTMENT_NAME || null,
            toInt(row.REVENUE_TYPE_ID),
            toInt(row.STORE_QTY_SOLD),
            toDecimal(row.MENU_ITEM_PRICE),
            toDecimal(row.STORE_DISCOUNT_TOTAL),
            toDecimal(row.STORE_SALES_TOTAL),
            toDecimal(row.STORE_NET_SALES),
            toDecimal(row.THEORETICAL_COST),
            toInt(row.PRICE_LEVEL),
            row.MAJOR_GROUP_ID || null,
            row.FAMILY_GROUP_NAME || null,
            row.PRODUCT_GROUP_ID || null,
            row.MENU_GROUP_1 || null,
            row.MENU_GROUP_2 || null,
            row.QUALITY_GROUP || null,
            row.RECIPE_NAME || null,
            row.CONCEPT2 || null,
          ]);
        }
      }
    }

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, message: "Uploaded files were empty." });
    }

    // 2. Query DB to collect the specific columns needed for verification
    const checkSql = `
      SELECT FISCAL_YEAR, PERIOD_NUM, BUSINESS_UNIT_NAME, MENU_ITEM_ID, CONCEPT_ID 
      FROM snowflake_data
    `;
    const [dbRows] = await db.query(checkSql);


    const existingRows = new Set(
      dbRows.map(r => {
        const bu = r.BUSINESS_UNIT_NAME ? String(r.BUSINESS_UNIT_NAME).trim() : "";
        const concept = r.CONCEPT_ID ? String(r.CONCEPT_ID).trim() : "";
        return `${r.FISCAL_YEAR}|${r.PERIOD_NUM}|${bu}|${r.MENU_ITEM_ID}|${concept}`;
      })
    );

    const validInserts = [];
    const duplicatedRecords = [];

    // 3. Evaluate your raw data lines against the lookup Set
    for (const row of buffer) {
      const fiscalYear = row[0];
      const periodNum = row[1];
      const buName = row[2] ? String(row[2]).trim() : "";
      const menuItemId = row[6];
      const menuItemName = row[7];
      const conceptId = row[9] ? String(row[9]).trim() : "";

      // Construct a matching key layout pattern
      const key = `${fiscalYear}|${periodNum}|${buName}|${menuItemId}|${conceptId}`;

      if (existingRows.has(key)) {
        duplicatedRecords.push({
          fiscalYear,
          periodNum,
          businessUnitName: buName || "N/A",
          menuItemId,
          menuItemName: menuItemName || "Unknown Item",
          conceptId: conceptId || "N/A",
          reason: "Duplicate identified across selected constraints"
        });
      } else {
        validInserts.push(row);
        // Add to Set to block duplicates from sneaking in if they're repeated inside the same file
        existingRows.add(key);
      }
    }

    // 4. Batch run database insertions for unique rows
    if (validInserts.length > 0) {
      const insertSql = `
        INSERT INTO snowflake_data (
          FISCAL_YEAR, PERIOD_NUM, BUSINESS_UNIT_NAME, DEPT_ID, MICROS_LOC_NUM,
          RVC_NUM, MENU_ITEM_ID, MENU_ITEM_NAME, DEFSEQ, CONCEPT_ID,
          BRAND_CODE, DEPARTMENT_NAME, REVENUE_TYPE_ID, STORE_QTY_SOLD,
          MENU_ITEM_PRICE, STORE_DISCOUNT_TOTAL, STORE_SALES_TOTAL,
          STORE_NET_SALES, THEORETICAL_COST, PRICE_LEVEL, MAJOR_GROUP_ID,
          FAMILY_GROUP_NAME, PRODUCT_GROUP_ID, MENU_GROUP_1, MENU_GROUP_2,
          QUALITY_GROUP, RECIPE_NAME, CONCEPT2
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
      message: duplicatedRecords.length > 0
        ? "Data processed: Unique entries stored, duplicate profiles skipped."
        : "File integration completed successfully.",
      filesUploaded: req.files.length,
      totalInserted: totalRecordsInserted,
      duplicateCount: duplicatedRecords.length,
      duplicates: duplicatedRecords
    });

  } catch (err) {
    console.error("Snowflake Database Engine Upload Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



exports.getSnowflakeData = async (req, res) => {
  try {
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 10;

    const businessName = req.body.businessName;
    const familyGroupName = req.body.familyGroupName;
    const productGroupId = req.body.productGroupId;
    const conceptId = req.body.conceptId;
    const { search = "" } = req.body;


    const offset = (page - 1) * limit;

    let query = "SELECT * FROM snowflake_data";
    let countQuery = "SELECT COUNT(*) AS total FROM snowflake_data";
    const toatalCountQuery = "SELECT COUNT(*) AS totalCount FROM snowflake_data";


    const conditions = [];
    const values = [];
    const countValues = [];

    if (search) {
      const searchableColumns = ["MENU_ITEM_ID", "MENU_ITEM_NAME"];
      const searchConditions = searchableColumns.map(col => `${col} LIKE ?`);
      conditions.push(`(${searchConditions.join(" OR ")})`);

      searchableColumns.forEach(() => {
        values.push(`%${search}%`);
        countValues.push(`%${search}%`);
      });
    }

    if (businessName) {
      conditions.push("BUSINESS_UNIT_NAME = ?");
      values.push(businessName);
      countValues.push(businessName);
    }

    if (Array.isArray(familyGroupName) && familyGroupName.length > 0) {
      const placeholders = familyGroupName.map(() => "?").join(", ");
      conditions.push(`FAMILY_GROUP_NAME IN (${placeholders})`);
      values.push(...familyGroupName);
      countValues.push(...familyGroupName);
    }

    if (Array.isArray(productGroupId) && productGroupId.length > 0) {
      const placeholders = productGroupId.map(() => "?").join(", ");
      conditions.push(`PRODUCT_GROUP_ID IN (${placeholders})`);
      values.push(...productGroupId);
      countValues.push(...productGroupId);
    }

    if (conceptId) {
      conditions.push("CONCEPT_ID = ?");
      values.push(conceptId);
      countValues.push(conceptId);
    }

    if (conditions.length > 0) {
      const whereClause = " WHERE " + conditions.join(" AND ");
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY FISCAL_YEAR DESC, PERIOD_NUM DESC LIMIT ${offset}, ${limit}`;

    const [rows] = await db.query(query, values);
    const [count] = await db.query(countQuery, countValues);
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

exports.getBusinessUnits = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT BUSINESS_UNIT_NAME FROM snowflake_data  ORDER BY BUSINESS_UNIT_NAME"
    );

    const bussinessUnitName = rows.map(
      row => row.BUSINESS_UNIT_NAME
    );

    res.status(200).json({
      success: true,
      data: bussinessUnitName,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getFamilyGroupName = async (req, res) => {
  try {
    const [rows] = await db.query(
      "select distinct FAMILY_GROUP_NAME from snowflake_data where FAMILY_GROUP_NAME is not null order by FAMILY_GROUP_NAME");

    const familyGroups = rows.map(
      row => row.FAMILY_GROUP_NAME
    );
    res.status(200).json({
      sucess: true,
      data: familyGroups
    });
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
}
exports.getProductGroupId = async (req, res) => {
  try {
    const [rows] = await db.query(
      "select distinct PRODUCT_GROUP_ID from snowflake_data where PRODUCT_GROUP_ID is not null order by PRODUCT_GROUP_ID");

    const productId = rows.map(
      row => row.PRODUCT_GROUP_ID
    );
    res.status(200).json({
      sucess: true,
      data: productId,
    });
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
}

exports.getConceptId = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT DISTINCT CONCEPT_ID FROM snowflake_data where CONCEPT_ID is not null ORDER BY CONCEPT_ID");
    const conceptId = rows.map(row => row.CONCEPT_ID);
    res.status(200).json({
      success: true,
      data: conceptId,
    })
  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

exports.getMajorGroupId = async (req, res) => {
  try {
    const [rows] = await db.query("select distinct MAJOR_GROUP_ID from snowflake_data where  MAJOR_GROUP_ID IS NOT NULL ORDER BY   MAJOR_GROUP_ID");
    const majorGroupId = rows.map(row => row.MAJOR_GROUP_ID);
    res.status(200).json({
      success: true,
      data: majorGroupId,
    })

  }
  catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}


exports.getBusinessUnitCount = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        BUSINESS_UNIT_NAME,
        COUNT(*) AS total
      FROM snowflake_data
      WHERE BUSINESS_UNIT_NAME IS NOT NULL
      GROUP BY BUSINESS_UNIT_NAME
      ORDER BY BUSINESS_UNIT_NAME
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


