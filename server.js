require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();

// ================= CONFIG =================
const PORT = 5000; // 🔥 FIXED PORT
const MONGO_URI = "mongodb+srv://priyanshudatta80_db_user:S1v9epNKL0wZy5W0@cluster0.4twqtaz.mongodb.net/test?appName=Cluster0";
const PYTHON_PATH = process.env.PYTHON_PATH || "python";
const UPLOAD_FOLDER = "uploads";

// ================= MIDDLEWARE =================
app.use(cors());

app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});



app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static(UPLOAD_FOLDER));

// ================= CREATE UPLOAD FOLDER =================
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER);
}

// ================= DATABASE =================
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err));

// ================= SCHEMA =================
const Prediction = mongoose.model("Prediction", new mongoose.Schema({
  filename: String,
  predictedClass: String,
  confidence: Number,
  createdAt: { type: Date, default: Date.now }
}));

// ================= MULTER =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_FOLDER),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// ================= PYTHON CALL =================
function runModel(imagePath) {
  return new Promise((resolve, reject) => {
    const python = spawn(PYTHON_PATH, ["predict.py", imagePath]);

    let output = "";
    let error = "";

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      console.log("RAW PYTHON OUTPUT:\n", output);

      if (code !== 0 || error) {
        return reject(error || "Python error");
      }

      try {
        const clean = output.trim().split("\n").pop();
        const result = JSON.parse(clean);
        resolve(result);
      } catch {
        reject("Invalid JSON from Python");
      }
    });
  });
}

// ================= ROUTES =================

// Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Predict
app.post("/api/predict", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await runModel(req.file.path);

    const saved = await Prediction.create({
      filename: req.file.filename,
      predictedClass: result.predicted_class,
      confidence: result.confidence
    });

    res.json({
      success: true,
      data: {
        id: saved._id,
        filename: req.file.filename,
        prediction: result.predicted_class,
        confidence: result.confidence,
        allPredictions: result.all_predictions || {},
        image: `http://localhost:5000/uploads/${req.file.filename}` // 🔥 updated
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.toString() });
  }
});

// Get all
app.get("/api/predictions", async (req, res) => {
  const data = await Prediction.find().sort({ createdAt: -1 });
  res.json({ success: true, data });
});

// Get one
app.get("/api/predictions/:id", async (req, res) => {
  const pred = await Prediction.findById(req.params.id);
  res.json({ success: true, data: pred });
});

// Delete
app.delete("/api/predictions/:id", async (req, res) => {
  await Prediction.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Stats
app.get("/api/stats", async (req, res) => {
  const data = await Prediction.find();

  const total = data.length;
  let totalConfidence = 0;

  const classDistribution = {
    good: 0,
    satisfactory: 0,
    poor: 0,
    very_poor: 0
  };

  data.forEach(p => {
    if (classDistribution[p.predictedClass] !== undefined) {
      classDistribution[p.predictedClass]++;
    }
    totalConfidence += p.confidence;
  });

  res.json({
    success: true,
    data: {
      totalPredictions: total,
      classDistribution,
      averageConfidence: total ? (totalConfidence / total).toFixed(2) : 0
    }
  });
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});