const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const connectDB = require("../config/db");

const Product = require("../models/product.model");
const Order = require("../models/order.model");
const DeviceListing = require("../models/deviceListing.model");
const Inspection = require("../models/inspection.model");
const Coupon = require("../models/coupon.model");
const User = require("../models/user.model");

async function verify() {
  await connectDB();
  console.log("MongoDB connection established via connectDB.\n");

  const [productsCount, ordersCount, listingsCount, inspectionsCount, couponsCount, customersCount] = await Promise.all([
    Product.countDocuments(),
    mongoose.model("Order").countDocuments(),
    DeviceListing.countDocuments(),
    Inspection.countDocuments(),
    Coupon.countDocuments(),
    User.countDocuments({ role: "user" }),
  ]);

  console.log("=== FELCON MARKETPLACE VERIFICATION ===");
  console.log(`• Total Genuine Products in Catalog (2022-2026): ${productsCount}`);
  console.log(`• Total Orders: ${ordersCount}`);
  console.log(`• Total Selling Requests: ${listingsCount}`);
  console.log(`• Total Certified Inspections: ${inspectionsCount}`);
  console.log(`• Total Active Coupons: ${couponsCount}`);
  console.log(`• Total Registered Customers: ${customersCount}`);

  // Test an active coupon query
  const sampleCoupon = await Coupon.findOne({ code: "FELCON10" });
  console.log("\nSample Coupon FELCON10:", sampleCoupon ? `${sampleCoupon.code} - ${sampleCoupon.discountValue}% (${sampleCoupon.isActive ? "Active" : "Inactive"})` : "Not found");

  // Sample Product check
  const sampleProduct = await Product.findOne({ condition: { $in: ["Like New", "Superb"] } });
  if (sampleProduct) {
    console.log("\nSample Product:", {
      title: sampleProduct.title,
      brand: sampleProduct.brand,
      category: sampleProduct.category,
      releaseYear: sampleProduct.releaseYear,
      condition: sampleProduct.condition,
      batteryHealth: sampleProduct.batteryHealth,
      price: sampleProduct.price,
      inspectionCertified: sampleProduct.inspectionCertified,
    });
  }

  await mongoose.disconnect();
  console.log("\nVerification complete.");
  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
