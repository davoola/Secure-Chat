const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const upload_path = "./public/upload";

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, upload_path);
  },
  filename: function (req, file, callback) {
    const fileExtension = path.extname(file.originalname);
    callback(null, file.fieldname + '-' + Date.now() + fileExtension);
  },
});

const upload = multer({ storage: storage });

function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

router.post("/", upload.single("file"), async (req, res, next) => {
  const { file } = req;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const fileExtension = path.extname(file.originalname);
    const sha256 = await calculateSHA256(file.path);
    const newFileName = sha256 + fileExtension;
    const newPath = path.join(upload_path, newFileName);

    fs.renameSync(file.path, newPath);

    res.json({
      path: "/upload/" + newFileName,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).send('Error processing file');
  }
});

module.exports = router;