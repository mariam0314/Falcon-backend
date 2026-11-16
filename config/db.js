const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

let mongodProcess = null;

function isPortOpen(port, host = "127.0.0.1", timeout = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;
    socket.setTimeout(timeout);
    socket.once("connect", () => {
      status = true;
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function startLocalMongod() {
  const dbPath = path.join(__dirname, "..", ".db_data");
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

  const defaultBinary = "C:\\Users\\maria\\.cache\\mongodb-binaries\\mongod-x64-win32-8.2.6.exe";
  let mongodBin = defaultBinary;

  if (!fs.existsSync(mongodBin)) {
    try {
      const { MongoBinary } = require("mongodb-memory-server-core");
      mongodBin = await MongoBinary.getPath();
    } catch {
      mongodBin = "mongod";
    }
  }

  console.log(`🚀 Starting local MongoDB instance from: ${mongodBin}`);
  const proc = spawn(mongodBin, ["--dbpath", dbPath, "--port", "27017", "--bind_ip", "127.0.0.1"], {
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  mongodProcess = proc;

  // Cleanup handler
  const cleanup = () => {
    if (mongodProcess) {
      try {
        mongodProcess.kill("SIGINT");
      } catch {}
      mongodProcess = null;
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  // Wait until mongod reports ready or port becomes connectable
  await new Promise((resolve, reject) => {
    let resolved = false;

    proc.stdout.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Waiting for connections") || msg.includes("waiting for connections")) {
        if (!resolved) {
          resolved = true;
          console.log("Local MongoDB is ready for connections! ✅");
          resolve();
        }
      }
    });

    proc.stderr.on("data", (data) => {
      // quiet unless debug
    });

    proc.on("exit", (code) => {
      if (!resolved) {
        reject(new Error(`mongod exited unexpectedly with code ${code}`));
      }
    });

    // Check with socket every 500ms
    const interval = setInterval(async () => {
      if (resolved) {
        clearInterval(interval);
        return;
      }
      const open = await isPortOpen(27017);
      if (open && !resolved) {
        resolved = true;
        clearInterval(interval);
        resolve();
      }
    }, 500);

    setTimeout(() => {
      if (!resolved) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for local MongoDB to start"));
      }
    }, 40000);
  });
}

async function connectToDB() {
  const remoteUri = process.env.MONGO_URI;
  const localUri = "mongodb://127.0.0.1:27017/falcon";

  let connected = false;

  // 1. Try remote Atlas connection if configured
  if (remoteUri && !remoteUri.includes("127.0.0.1") && !remoteUri.includes("localhost")) {
    try {
      console.log("Attempting connection to MongoDB Atlas...");
      await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 2500 });
      console.log("Server is Connected to MongoDB Atlas ✅");
      connected = true;
    } catch (err) {
      console.warn("⚠️ MongoDB Atlas connection unavailable (IP restriction/SSL):", err.message);
      console.log("Falling back to local persistent MongoDB...");
    }
  }

  // 2. Fall back to local MongoDB
  if (!connected) {
    const portOpen = await isPortOpen(27017);
    if (!portOpen) {
      await startLocalMongod();
    }
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
    console.log("Server is Connected to Local MongoDB (port 27017) ✅");
  }

  // 3. Auto-seed if database is empty or has fewer than 30 products
  try {
    const Product = require("../models/product.model");
    const count = await Product.countDocuments();
    if (count < 30) {
      console.log(`Product count is currently ${count}. Running auto-seed...`);
      const seedDatabase = require("../seed/comprehensiveSeed");
      await seedDatabase();
    } else {
      console.log(`Database currently has ${count} products available.`);
    }
  } catch (err) {
    console.warn("Auto-seed check notice:", err.message);
  }
}

module.exports = connectToDB;
