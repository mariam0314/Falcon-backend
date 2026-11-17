const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const connectDB = require("../config/db");

const Product = require("../models/product.model");
const Order = require("../models/order.model");
const User = require("../models/user.model");

async function persistOrders() {
  await connectDB();

  const user = await User.findOne({ role: "user" }) || await User.findOne();
  const admin = await User.findOne({ role: "admin" }) || user;
  const products = await Product.find({ status: "available" }).limit(3);

  const o1 = await Order.create({
    product: products[0]._id,
    buyer: user._id,
    seller: admin._id,
    sellerRole: "admin",
    transactionType: "buy",
    salePrice: products[0].price,
    finalPayable: products[0].price - 14000,
    commissionRate: 2,
    commissionAmount: Math.round(products[0].price * 0.02),
    sellerEarnings: products[0].price - Math.round(products[0].price * 0.02),
    status: "shipped",
    paymentMethod: "UPI",
    paymentStatus: "completed",
    courier: {
      partner: "BlueDart Express",
      trackingId: "FEL-BD-729104",
      status: "shipped",
      shippedAt: new Date(Date.now() - 2 * 3600 * 1000),
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    shippingAddress: {
      name: "Pooja Patel",
      phone: "9876543210",
      address: "B-204, Green Heights, Outer Ring Road",
      city: "Bengaluru",
      pincode: "560103",
    },
    exchange: {
      isExchange: true,
      brand: "Apple",
      model: "iPhone 12",
      condition: "Good",
      value: 14000,
      status: "pending_pickup",
    },
    statusHistory: [
      { status: "confirmed", label: "Confirmed", timestamp: new Date(Date.now() - 36 * 3600 * 1000), note: "Order placed & verified" },
      { status: "processing", label: "Processing", timestamp: new Date(Date.now() - 24 * 3600 * 1000), note: "Hub allocation" },
      { status: "quality_check", label: "Quality Check", timestamp: new Date(Date.now() - 18 * 3600 * 1000), note: "Passed 32 diagnostics" },
      { status: "packed", label: "Packed", timestamp: new Date(Date.now() - 10 * 3600 * 1000), note: "Eco-packaging sealed" },
      { status: "shipped", label: "Shipped", timestamp: new Date(Date.now() - 2 * 3600 * 1000), note: "Handed over to BlueDart Express" },
    ],
  });

  const o2 = await Order.create({
    product: products[1]._id,
    buyer: user._id,
    seller: admin._id,
    sellerRole: "admin",
    transactionType: "buy",
    salePrice: products[1].price,
    finalPayable: Math.round(products[1].price * 0.9),
    commissionRate: 2,
    commissionAmount: Math.round(products[1].price * 0.02),
    sellerEarnings: products[1].price - Math.round(products[1].price * 0.02),
    status: "processing",
    paymentMethod: "Cash",
    paymentStatus: "pending",
    courier: {
      partner: "BlueDart Express",
      trackingId: "FEL-BD-819205",
      status: "processing",
      estimatedDelivery: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    },
    coupon: {
      code: "FELCON10",
      discountAmount: Math.round(products[1].price * 0.1),
    },
    shippingAddress: {
      name: "Vikram Sengupta",
      phone: "9823456789",
      address: "Tower 5, Apartment 701, Powai Lake View",
      city: "Mumbai",
      pincode: "400076",
    },
    statusHistory: [
      { status: "confirmed", label: "Confirmed", timestamp: new Date(Date.now() - 12 * 3600 * 1000), note: "Order placed via COD" },
      { status: "processing", label: "Processing", timestamp: new Date(Date.now() - 4 * 3600 * 1000), note: "Hub preparing order" },
    ],
  });

  console.log(`Created sample orders:`);
  console.log(`1. ${o1._id} (shipped, BlueDart tracking ${o1.courier.trackingId}, trade-in applied)`);
  console.log(`2. ${o2._id} (processing, coupon FELCON10 applied)`);

  const count = await Order.countDocuments();
  console.log(`Total active orders in DB: ${count}`);

  await mongoose.disconnect();
  process.exit(0);
}

persistOrders().catch((err) => {
  console.error("persistOrders error:", err);
  process.exit(1);
});
