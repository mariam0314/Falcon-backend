require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectToDB = require("./config/db");
const socketHandler = require("./socket/socket");

connectToDB();

const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: [clientOrigin, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
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