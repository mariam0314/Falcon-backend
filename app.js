const express      = require("express");
const cookieParser = require("cookie-parser");
const cors         = require("cors");
const app          = express();
const { startExpirySuperSellerJob } = require("./jobs/expireSuperSellerWindow.job");

app.use(express.json());
app.use(cookieParser());

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

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
}));

app.get("/", (_req, res) => {
  res.json({ message: "BechDo API is running" });
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(204).end();
});

// Start cron jobs
startExpirySuperSellerJob();

// Import route handlers
const authRouter         = require("./routes/auth.routes");
const productRouter      = require("./routes/product.routes");
const subscriptionRouter = require("./routes/subscription.routes");
const adminRouter        = require("./routes/admin.routes");
const buysellRouter      = require("./routes/buysell.routes");
const messageRouter      = require("./routes/message.routes");
const profileRouter      = require("./routes/profile.routes");
const wishlistRouter     = require("./routes/wishlist.routes");
const cartRouter         = require("./routes/cart.routes");
const deviceSellRouter   = require("./routes/deviceSell.routes");
const locationRouter     = require("./routes/location.routes");

// API routes
app.use("/api/auth",          authRouter);
app.use("/api/products",      productRouter);
app.use("/api/subscriptions", subscriptionRouter);
app.use("/api/admin",         adminRouter);
app.use("/api/orders",        buysellRouter);
app.use("/api/messages",      messageRouter);
app.use("/api/profile",       profileRouter);
app.use("/api/wishlist",      wishlistRouter);
app.use("/api/cart",          cartRouter);
app.use("/api/device-sell",   deviceSellRouter);
app.use("/api/location",      locationRouter);


module.exports = app;