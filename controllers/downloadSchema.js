const PDFDocument = require("pdfkit");

exports.downloadSnoflakeSchema = async (req, res) => {
  try {
    const schema = [
      { column: "FISCAL_YEAR", type: "SMALLINT" },
      { column: "PERIOD_NUM", type: "TINYINT" },
      { column: "BUSINESS_UNIT_NAME", type: "VARCHAR(225) PK" },
      { column: "DEPT_ID", type: "VARCHAR(225) PK" },
      { column: "MICROS_LOC_NUM", type: "INT" },
      { column: "RVC_NUM", type: "INT" },
      { column: "MENU_ITEM_ID", type: "BIGINT PK" },
      { column: "MENU_ITEM_NAME", type: "VARCHAR(500)" },
      { column: "DEFSEQ", type: "INT PK" },
      { column: "CONCEPT_ID", type: "VARCHAR(225)" },
      { column: "BRAND_CODE", type: "VARCHAR(225)" },
      { column: "DEPARTMENT_NAME", type: "VARCHAR(500)" },
      { column: "REVENUE_TYPE_ID", type: "INT" },
      { column: "STORE_QTY_SOLD", type: "DECIMAL(18,4)" },
      { column: "MENU_ITEM_PRICE", type: "DECIMAL(18,6)" },
      { column: "STORE_DISCOUNT_TOTAL", type: "DECIMAL(18,6)" },
      { column: "STORE_SALES_TOTAL", type: "DECIMAL(18,6)" },
      { column: "STORE_NET_SALES", type: "DECIMAL(18,6)" },
      { column: "THEORETICAL_COST", type: "DECIMAL(18,6)" },
      { column: "PRICE_LEVEL", type: "INT" },
      { column: "MAJOR_GROUP_ID", type: "VARCHAR(225)" },
      { column: "FAMILY_GROUP_NAME", type: "VARCHAR(225)" },
      { column: "PRODUCT_GROUP_ID", type: "VARCHAR(225)" },
      { column: "MENU_GROUP_1", type: "VARCHAR(225)" },
      { column: "MENU_GROUP_2", type: "VARCHAR(225)" },
      { column: "QUALITY_GROUP", type: "VARCHAR(225)" },
      { column: "RECIPE_NAME", type: "TEXT" },
      { column: "CONCEPT2", type: "VARCHAR(225)" },
      { column: "CREATED_AT", type: "TIMESTAMP" },
    ];

    const doc = new PDFDocument({
      size: "A4",
      margin: 30,
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Snowflake_Data_Schema.pdf"
    );
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

   
    doc
      .fontSize(18)
      .text("Snowflake Table Schema", {
        align: "center",
      });

    doc.moveDown(2);

    const startX = 30;
    let y = 100;

    const col1Width = 280;
    const col2Width = 220;
    const rowHeight = 25;

   
    doc.rect(startX, y, col1Width, rowHeight).stroke();
    doc.rect(startX + col1Width, y, col2Width, rowHeight).stroke();

    doc
      .fontSize(11)
      .text("Column Name", startX + 10, y + 7);

    doc
      .fontSize(11)
      .text("Data Type", startX + col1Width + 10, y + 7);

    y += rowHeight;

    schema.forEach((item) => {
      
      if (y > 730) {
        doc.addPage();

        y = 50;

      
        doc.rect(startX, y, col1Width, rowHeight).stroke();
        doc.rect(startX + col1Width, y, col2Width, rowHeight).stroke();

        doc.text("Column Name", startX + 10, y + 7);
        doc.text(
          "Data Type",
          startX + col1Width + 10,
          y + 7
        );

        y += rowHeight;
      }

      doc.rect(startX, y, col1Width, rowHeight).stroke();

      // Type cell
      doc
        .rect(
          startX + col1Width,
          y,
          col2Width,
          rowHeight
        )
        .stroke();

      doc.fontSize(10).text(
        item.column,
        startX + 10,
        y + 7,
        {
          width: col1Width - 20,
        }
      );

      doc.fontSize(10).text(
        item.type,
        startX + col1Width + 10,
        y + 7,
        {
          width: col2Width - 20,
        }
      );

      y += rowHeight;
    });

    doc.end();
  } catch (error) {
    console.error("PDF Generation Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate schema PDF",
    });
  }
};