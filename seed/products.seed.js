/**
 * seed/products.seed.js
 * Seeds realistic products for FALCON marketplace.
 */
"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/product.model");
const User = require("../models/user.model");

const SAMPLE_PRODUCTS = [
  {
    title: "Apple iPhone 15 Pro Max (256 GB) - Natural Titanium",
    description: "Flawless condition iPhone 15 Pro Max with 96% battery health. Comes with original box, braided USB-C cable, and 6 months FALCON Assured warranty.",
    category: "mobile",
    brand: "Apple",
    deviceType: "refurbished",
    condition: "Superb",
    storage: "256 GB",
    color: "Natural Titanium",
    price: 114999,
    originalPrice: 159900,
    images: ["/products/iphone-15-pro-max.png"],
    rating: 4.8,
    quantity: 3,
    location: { type: "Point", coordinates: [77.2090, 28.6139] },
    address: { city: "New Delhi", state: "Delhi", pincode: "110001", full: "Connaught Place, New Delhi" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Apple A17 Pro", ram: "8 GB" },
      display: { sizeInches: "6.7 inches", type: "Super Retina XDR OLED", resolution: "2796x1290 px", refreshRate: "120 Hz" },
      rearCamera: { primary: "48 MP", secondary: "12 MP", tertiary: "12 MP" },
      battery: { capacity: "4441 mAh" },
    },
  },
  {
    title: "Samsung Galaxy S24 Ultra 5G (512 GB) - Titanium Gray",
    description: "Excellent refurbished Galaxy S24 Ultra with Galaxy AI features, built-in S-Pen, and stunning 200MP camera system.",
    category: "mobile",
    brand: "Samsung",
    deviceType: "refurbished",
    condition: "Superb",
    storage: "512 GB",
    color: "Titanium Gray",
    price: 99999,
    originalPrice: 139999,
    images: ["/products/samsung-s24-ultra.png"],
    rating: 4.9,
    quantity: 4,
    location: { type: "Point", coordinates: [72.8777, 19.0760] },
    address: { city: "Mumbai", state: "Maharashtra", pincode: "400001", full: "Bandra Kurla Complex, Mumbai" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Qualcomm Snapdragon 8 Gen 3", ram: "12 GB" },
      display: { sizeInches: "6.8 inches", type: "Dynamic AMOLED 2X", resolution: "3120x1440 px", refreshRate: "120 Hz" },
      rearCamera: { primary: "200 MP", secondary: "50 MP", tertiary: "12 MP", quaternary: "10 MP" },
      battery: { capacity: "5000 mAh" },
    },
  },
  {
    title: "OnePlus 12 5G (256 GB) - Silky Black",
    description: "Certified pre-owned OnePlus 12. Super-fast 100W SUPERVOOC charging, Hasselblad camera, pristine condition.",
    category: "mobile",
    brand: "OnePlus",
    deviceType: "refurbished",
    condition: "Good",
    storage: "256 GB",
    color: "Silky Black",
    price: 52999,
    originalPrice: 64999,
    images: ["/products/oneplus-12.png"],
    rating: 4.7,
    quantity: 5,
    location: { type: "Point", coordinates: [77.5946, 12.9716] },
    address: { city: "Bengaluru", state: "Karnataka", pincode: "560001", full: "Indiranagar, Bengaluru" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Snapdragon 8 Gen 3", ram: "12 GB" },
      display: { sizeInches: "6.82 inches", type: "LTPO AMOLED", resolution: "3168x1440 px", refreshRate: "120 Hz" },
      rearCamera: { primary: "50 MP", secondary: "64 MP", tertiary: "48 MP" },
      battery: { capacity: "5400 mAh" },
    },
  },
  {
    title: "Apple iPhone 13 (128 GB) - Midnight",
    description: "Great value refurbished iPhone 13 in Good condition. Full 32-point diagnostics passed with 100% functionality.",
    category: "mobile",
    brand: "Apple",
    deviceType: "refurbished",
    condition: "Good",
    storage: "128 GB",
    color: "Midnight",
    price: 38999,
    originalPrice: 59900,
    images: ["/products/iphone-13.png"],
    rating: 4.6,
    quantity: 8,
    location: { type: "Point", coordinates: [77.5946, 12.9716] },
    address: { city: "Bengaluru", state: "Karnataka", pincode: "560001", full: "Koramangala, Bengaluru" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Apple A15 Bionic", ram: "4 GB" },
      display: { sizeInches: "6.1 inches", type: "Super Retina XDR OLED", resolution: "2532x1170 px", refreshRate: "60 Hz" },
      rearCamera: { primary: "12 MP", secondary: "12 MP" },
      battery: { capacity: "3240 mAh" },
    },
  },
  {
    title: "Apple MacBook Air M2 (13.6-inch, 8GB RAM, 256GB SSD) - Space Gray",
    description: "Ultra-portable refurbished MacBook Air with M2 chip. Excellent battery cycle count under 45. Includes original MagSafe charger.",
    category: "laptop",
    brand: "Apple",
    deviceType: "refurbished",
    condition: "Superb",
    storage: "256 GB",
    color: "Space Gray",
    price: 74999,
    originalPrice: 99900,
    images: ["/products/macbook-air-m2.png"],
    rating: 4.9,
    quantity: 2,
    location: { type: "Point", coordinates: [77.5946, 12.9716] },
    address: { city: "Bengaluru", state: "Karnataka", pincode: "560001", full: "HSR Layout, Bengaluru" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Apple M2 8-core CPU", ram: "8 GB" },
      display: { sizeInches: "13.6 inches", type: "Liquid Retina", resolution: "2560x1664 px" },
      battery: { capacity: "52.6 Wh" },
    },
  },
  {
    title: "Dell XPS 15 9530 (Intel Core i7-13700H, 16GB, 1TB SSD, RTX 4050)",
    description: "High-performance creator and productivity laptop. Certified refurbished with FHD+ InfinityEdge display.",
    category: "laptop",
    brand: "Dell",
    deviceType: "refurbished",
    condition: "Good",
    storage: "1 TB",
    color: "Platinum Silver",
    price: 119999,
    originalPrice: 175000,
    images: ["/products/dell-xps-15.png"],
    rating: 4.7,
    quantity: 2,
    location: { type: "Point", coordinates: [72.8777, 19.0760] },
    address: { city: "Mumbai", state: "Maharashtra", pincode: "400001", full: "Andheri East, Mumbai" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Intel Core i7-13700H 14 cores", ram: "16 GB" },
      display: { sizeInches: "15.6 inches", type: "FHD+ 500 nits", resolution: "1920x1200 px" },
      battery: { capacity: "86 Wh" },
    },
  },
  {
    title: "Apple Watch Ultra 2 (GPS + Cellular, 49mm) - Natural Titanium",
    description: "Extreme sport smartwatch with precision dual-frequency GPS, 3000 nits display, and 36-hour battery life. Fully tested with warranty.",
    category: "smartwatch",
    brand: "Apple",
    deviceType: "refurbished",
    condition: "Superb",
    storage: "64 GB",
    color: "Natural Titanium",
    price: 64999,
    originalPrice: 89900,
    images: ["/products/apple-watch-ultra-2.png"],
    rating: 4.9,
    quantity: 3,
    location: { type: "Point", coordinates: [77.2090, 28.6139] },
    address: { city: "New Delhi", state: "Delhi", pincode: "110001", full: "Connaught Place, New Delhi" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Apple S9 SiP", ram: "1 GB" },
      display: { sizeInches: "1.92 inches", type: "OLED Retina", resolution: "502x410 px" },
      battery: { capacity: "542 mAh" },
    },
  },
  {
    title: "Apple iPad Air (11-inch, M2, Wi-Fi 128GB) - Space Gray",
    description: "Versatile Apple iPad Air powered by the M2 chip. Superb condition with 100% battery health and Apple Pencil Pro support.",
    category: "tablet",
    brand: "Apple",
    deviceType: "refurbished",
    condition: "Superb",
    storage: "128 GB",
    color: "Space Gray",
    price: 49999,
    originalPrice: 59900,
    images: ["/products/ipad-air-m2.png"],
    rating: 4.9,
    quantity: 3,
    location: { type: "Point", coordinates: [72.8777, 19.0760] },
    address: { city: "Mumbai", state: "Maharashtra", pincode: "400001", full: "Bandra Kurla Complex, Mumbai" },
    commissionRate: 1.5,
    specs: {
      performance: { chipsetFull: "Apple M2 8-core CPU", ram: "8 GB" },
      display: { sizeInches: "11 inches", type: "Liquid Retina", resolution: "2360x1640 px" },
      battery: { capacity: "28.93 Wh" },
    },
  },
];

async function seedProducts() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const seller = await User.findOne({ email: "seller@falcon.in" });
  if (!seller) {
    throw new Error("Seller seller@falcon.in not found. Run user init first.");
  }

  // Clear existing products if any
  await Product.deleteMany({});
  console.log("Cleared existing products");

  const docs = SAMPLE_PRODUCTS.map((p) => ({
    ...p,
    listedBy: seller._id,
    listedByRole: "seller",
    status: "available",
  }));

  const created = await Product.insertMany(docs);
  console.log(`Successfully seeded ${created.length} products for FALCON!`);
  process.exit(0);
}

seedProducts().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
