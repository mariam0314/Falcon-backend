const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const connectDB = require("../config/db");

const Product = require("../models/product.model");
const Order = require("../models/order.model");
const DeviceListing = require("../models/deviceListing.model");
const Inspection = require("../models/inspection.model");
const User = require("../models/user.model");

async function seedActivity() {
  await connectDB();

  const user = await User.findOne({ role: "user" }) || await User.findOne();
  const admin = await User.findOne({ role: "admin" }) || user;

  const products = await Product.find({ status: "available" }).limit(3);
  if (!products.length) {
    console.log("No products found to attach orders to.");
    process.exit(1);
  }

  // 1. Seed 2 Certified Inspections
  const existingInspections = await Inspection.countDocuments();
  if (existingInspections === 0) {
    await Inspection.create([
      {
        certificateId: `FLC-CERT-${Date.now().toString().slice(-7)}1`,
        product: products[0]._id,
        deviceTitle: products[0].title,
        category: products[0].category,
        brand: products[0].brand,
        workflowStatus: "inventory_approved",
        batteryHealthPercentage: products[0].batteryHealth || 94,
        cosmeticCondition: products[0].condition || "Superb",
        pointsPassed: 32,
        totalPoints: 32,
        inspectorName: "Senior Hardware Specialist · FELCON Lab",
        approvedByAdmin: true,
      },
      {
        certificateId: `FLC-CERT-${Date.now().toString().slice(-7)}2`,
        product: products[1]._id,
        deviceTitle: products[1].title,
        category: products[1].category,
        brand: products[1].brand,
        workflowStatus: "inventory_approved",
        batteryHealthPercentage: products[1].batteryHealth || 97,
        cosmeticCondition: products[1].condition || "Like New",
        pointsPassed: 32,
        totalPoints: 32,
        inspectorName: "Lead Diagnostics Engineer · FELCON Quality Hub",
        approvedByAdmin: true,
      },
    ]);
    console.log("Seeded 2 certified 32-point inspection records.");
  }

  // 2. Seed 2 Selling Requests (Doorstep Pickup)
  const existingListings = await DeviceListing.countDocuments();
  if (existingListings === 0) {
    await DeviceListing.create([
      {
        requestId: `FEL-SELL-829104`,
        listedBy: user._id,
        category: "mobile",
        brand: "Apple",
        model: "iPhone 13 Pro",
        storage: "256GB",
        ram: "6GB",
        basePrice: 45000,
        finalPrice: 38500,
        status: "available",
        contactName: "Rahul Sharma",
        contactPhone: "9876543210",
        pickupAddress: "402, Skyline Towers, Sector 44",
        city: "Gurugram",
        pincode: "122003",
        pickupDate: "Tomorrow",
        timeRange: "10:00 AM - 01:00 PM",
        pickup: {
          status: "scheduled",
          date: "Tomorrow",
          timeRange: "10:00 AM - 01:00 PM",
          contactName: "Rahul Sharma",
          contactPhone: "9876543210",
          address: "402, Skyline Towers, Sector 44",
          city: "Gurugram",
          pincode: "122003",
        },
        evaluation: {
          physicalCondition: "Flawless",
          defects: [
            { id: "minor_scratches", label: "Minor body scratches on frame" },
          ],
        },
      },
      {
        requestId: `FEL-SELL-910482`,
        listedBy: user._id,
        category: "laptop",
        brand: "Apple",
        model: "MacBook Air M1",
        storage: "256GB",
        ram: "8GB",
        basePrice: 48000,
        finalPrice: 42000,
        status: "accepted",
        contactName: "Neha Verma",
        contactPhone: "9812345678",
        pickupAddress: "Flat 12B, Palm Grove Residency",
        city: "New Delhi",
        pincode: "110025",
        pickupDate: "Day After Tomorrow",
        timeRange: "02:00 PM - 05:00 PM",
        pickup: {
          status: "agent_assigned",
          date: "Day After Tomorrow",
          timeRange: "02:00 PM - 05:00 PM",
          contactName: "Neha Verma",
          contactPhone: "9812345678",
          address: "Flat 12B, Palm Grove Residency",
          city: "New Delhi",
          pincode: "110025",
        },
        evaluation: {
          physicalCondition: "Good",
          defects: [],
        },
      },
    ]);
    console.log("Seeded 2 doorstep selling requests.");
  }

  // 3. Seed 2 Orders (One with trade-in exchange, one with coupon)
  const existingOrders = await Order.countDocuments();
  if (existingOrders === 0) {
    const tracking1 = `FEL-BD-729104`;
    const tracking2 = `FEL-BD-819205`;

    await Order.create([
      {
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
          trackingId: tracking1,
          status: "shipped",
          shippedAt: new Date(),
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
      },
      {
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
          trackingId: tracking2,
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
      },
    ]);
    console.log("Seeded 2 active marketplace orders with 7-stage fulfillment tracking.");
  }

  await mongoose.disconnect();
  console.log("All sample marketplace activities seeded successfully.");
  process.exit(0);
}

seedActivity().catch((err) => {
  console.error("seedActivity error:", err);
  process.exit(1);
});
