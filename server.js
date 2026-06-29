require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto= require("crypto");
const bcrypt = require("bcrypt");
const nodemailer= require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const authRoutes = require("./routes/authRoutes");
const snowflakeRoutes = require("./routes/snowflakeRoutes");
const qrRoutes = require("./routes/qrRoutes");
const bptRoutes=require("./routes/bptRoutes");
const reportRoutes=require("./routes/reportRoutes");
const downloadSchemaRoutes=require("./routes/downlaodSchemaRoutes");
const totaluploadedRecordsRoutes=require("./routes/totaluploadedRecordsRoutes");
const chartsRoutes= require("./routes/chartsRoutes");
const clearDataInDBRoutes =require("./routes/clearDataInDBRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/snowflake", snowflakeRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/bpt",bptRoutes);
app.use("/api/report",reportRoutes);
app.use("/api/schema",downloadSchemaRoutes);
app.use("/api/records",totaluploadedRecordsRoutes);
app.use("/api/graphData",chartsRoutes);
 app.use("/api",clearDataInDBRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});