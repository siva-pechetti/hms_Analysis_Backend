const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
    files: 500
  },
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [".xlsx", ".xls"];
  const ext = path.extname(file.originalname);

  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel allowed"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;