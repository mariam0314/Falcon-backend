require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectToDB = require("./config/db");
const socketHandler = require("./socket/socket");

connectToDB();

const server = http.createServer(app);

const clientOrigin = (process.env.CLIENT_URL || "").replace(/\/+$/, "");

const allowedOrigins = [
  clientOrigin,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
  "https://falcon-38uo.vercel.app",
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/.*falcon.*\.vercel\.app$/.test(origin)) return true;
  return false;
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by Socket CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST"]
  },
});

// Socket 
app.set("io", io);
socketHandler(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} ✅`);
});