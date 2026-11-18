const mongoose = require("mongoose");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const DeviceCatalog = require("../models/deviceCatalog.model");
const EvaluationConfig = require("../models/evaluationConfig.model");
const Coupon = require("../models/coupon.model");
const Inspection = require("../models/inspection.model");
const DeviceListing = require("../models/deviceListing.model");
const ALL_GENUINE_PRODUCTS = require("./masterCatalogueData");

// ─── Evaluation Configurations for the 4 Refurbished Categories ───────────────
const evaluationConfigs = [
  {
    category: "mobile",
    processingFee: 199,
    questions: [
      { key: "device_turns_on", label: "Does the mobile turn on and work normally?", order: 1, deductionOnNo: 60 },
      { key: "touch_working", label: "Is the touchscreen responsive across the entire surface?", order: 2, deductionOnNo: 30 },
      { key: "can_make_calls", label: "Can the phone make/receive calls with functional mic & speaker?", order: 3, deductionOnNo: 25 },
      { key: "camera_working", label: "Are both front and rear cameras operational?", order: 4, deductionOnNo: 20 },
      { key: "biometrics", label: "Does Face ID or Fingerprint unlock work properly?", order: 5, deductionOnNo: 10 },
    ],
    defects: [
      {
        key: "screen_damage", label: "Display / Screen Condition", order: 1, deduction: 0,
        children: [
          { key: "screen_cracked", label: "Cracked or shattered front glass", deduction: 40 },
          { key: "dead_pixels", label: "Dead pixels, spots, or colored vertical lines", deduction: 25 },
          { key: "minor_scratches", label: "Minor visible micro-scratches on glass", deduction: 8 },
        ]
      },
      {
        key: "body_damage", label: "Chassis & Back Panel", order: 2, deduction: 0,
        children: [
          { key: "back_cracked", label: "Back glass or panel cracked", deduction: 15 },
          { key: "body_dents", label: "Dents or deep nicks along metallic edges", deduction: 10 },
          { key: "bent_frame", label: "Chassis visibly bent or warped", deduction: 30 },
        ]
      },
      {
        key: "hardware_issues", label: "Internal Hardware & Battery", order: 3, deduction: 0,
        children: [
          { key: "battery_weak", label: "Battery drains very fast (health under 80%)", deduction: 18 },
          { key: "charging_port", label: "Charging port loose or only charges at angles", deduction: 12 },
          { key: "speaker_mic", label: "Muffled speaker or faulty microphone", deduction: 10 },
        ]
      }
    ],
    accessories: [
      { key: "original_box", label: "Original Brand Box included", order: 1, addition: 3 },
      { key: "original_charger", label: "Original Fast Charger / Cable", order: 2, addition: 4 },
      { key: "valid_bill", label: "Original purchase tax invoice", order: 3, addition: 3 },
    ]
  },
  {
    category: "laptop",
    processingFee: 399,
    questions: [
      { key: "powers_on", label: "Does the laptop turn on and boot to OS normally?", order: 1, deductionOnNo: 65 },
      { key: "screen_working", label: "Is the screen working with no flickering or lines?", order: 2, deductionOnNo: 35 },
      { key: "keyboard_working", label: "Do all keyboard keys and trackpad gestures work?", order: 3, deductionOnNo: 20 },
      { key: "battery_charges", label: "Does the battery hold a charge and work off the adapter?", order: 4, deductionOnNo: 25 },
      { key: "ports_wifi", label: "Are Wi-Fi, Bluetooth, and USB ports fully working?", order: 5, deductionOnNo: 15 },
    ],
    defects: [
      {
        key: "screen_damage", label: "Display & Hinge Condition", order: 1, deduction: 0,
        children: [
          { key: "screen_cracked", label: "Cracked screen or broken panel", deduction: 50 },
          { key: "hinge_loose", label: "Broken or loose screen hinges", deduction: 25 },
          { key: "dead_pixels", label: "Dead pixels or backlight bleeding", deduction: 18 },
        ]
      },
      {
        key: "body_damage", label: "Casing & Keyboard", order: 2, deduction: 0,
        children: [
          { key: "keyboard_damaged", label: "Sticky, broken, or missing keys", deduction: 20 },
          { key: "body_dents", label: "Cracks, dents, or broken corners on lid/base", deduction: 15 },
        ]
      },
      {
        key: "internals", label: "Motherboard & Components", order: 3, deduction: 0,
        children: [
          { key: "fan_noise", label: "Overheating or loud rattling fan", deduction: 12 },
          { key: "battery_dead", label: "Battery does not hold charge (runs only plugged in)", deduction: 30 },
        ]
      }
    ],
    accessories: [
      { key: "original_charger", label: "Original OEM Power Adapter / MagSafe", order: 1, addition: 5 },
      { key: "original_box", label: "Original Laptop Retail Box", order: 2, addition: 3 },
      { key: "valid_bill", label: "Valid purchase invoice/bill", order: 3, addition: 3 },
    ]
  },
  {
    category: "tablet",
    processingFee: 249,
    questions: [
      { key: "device_turns_on", label: "Does the tablet turn on and function properly?", order: 1, deductionOnNo: 60 },
      { key: "touch_working", label: "Does the touchscreen work smoothly across all zones?", order: 2, deductionOnNo: 30 },
      { key: "battery_charges", label: "Does the battery hold charge without instant drop?", order: 3, deductionOnNo: 22 },
      { key: "cameras_speakers", label: "Are cameras, mic, and speakers fully working?", order: 4, deductionOnNo: 15 },
    ],
    defects: [
      {
        key: "display_damage", label: "Display Glass & Touch", order: 1, deduction: 0,
        children: [
          { key: "screen_cracked", label: "Glass cracked or shattered", deduction: 45 },
          { key: "display_spots", label: "Bright spots, burn-in, or dead pixels", deduction: 20 },
        ]
      },
      {
        key: "body_damage", label: "Chassis & Back Enclosure", order: 2, deduction: 0,
        children: [
          { key: "body_bent", label: "Tablet frame bent or twisted", deduction: 25 },
          { key: "deep_scratches", label: "Deep dents or heavy scratches on back", deduction: 12 },
        ]
      }
    ],
    accessories: [
      { key: "stylus_pencil", label: "Apple Pencil / S Pen Stylus included", order: 1, addition: 6 },
      { key: "original_box", label: "Original Box", order: 2, addition: 3 },
      { key: "original_charger", label: "Original Charger & Cable", order: 3, addition: 4 },
    ]
  },
  {
    category: "smartwatch",
    processingFee: 149,
    questions: [
      { key: "watch_turns_on", label: "Does the watch turn on and pair with a phone?", order: 1, deductionOnNo: 65 },
      { key: "touch_screen", label: "Does the watch touchscreen and crown/buttons work?", order: 2, deductionOnNo: 28 },
      { key: "sensors_working", label: "Do heart rate and fitness sensors read accurately?", order: 3, deductionOnNo: 20 },
      { key: "battery_good", label: "Does battery hold charge throughout the day?", order: 4, deductionOnNo: 22 },
    ],
    defects: [
      {
        key: "screen_damage", label: "Watch Face & Crystal", order: 1, deduction: 0,
        children: [
          { key: "glass_cracked", label: "Glass crystal cracked or chipped", deduction: 50 },
          { key: "heavy_scratches", label: "Heavy visible scratches on screen", deduction: 15 },
        ]
      },
      {
        key: "body_strap", label: "Watch Case & Sensors", order: 2, deduction: 0,
        children: [
          { key: "case_dents", label: "Deep dents or gouges on casing", deduction: 12 },
          { key: "sensor_damaged", label: "Rear sensor glass cracked or peeling", deduction: 25 },
        ]
      }
    ],
    accessories: [
      { key: "original_charger", label: "Original Magnetic Charging Dock/Cable", order: 1, addition: 6 },
      { key: "original_box", label: "Original Watch Box", order: 2, addition: 3 },
      { key: "extra_strap", label: "Original Extra Band/Strap", order: 3, addition: 3 },
    ]
  }
];

// ─── Coupons ──────────────────────────────────────────────────────────────────
const defaultCoupons = [
  {
    code: "FELCON10",
    description: "10% Instant Discount on All Refurbished Products",
    discountType: "percentage",
    discountValue: 10,
    maxDiscount: 3000,
    minOrderAmount: 2000,
  },
  {
    code: "CASHIFY500",
    description: "Flat ₹500 Off on orders above ₹5,000",
    discountType: "fixed",
    discountValue: 500,
    maxDiscount: 500,
    minOrderAmount: 5000,
  },
  {
    code: "WELCOME2026",
    description: "New Customer Special: Flat ₹1,000 Off",
    discountType: "fixed",
    discountValue: 1000,
    maxDiscount: 1000,
    minOrderAmount: 10000,
  },
  {
    code: "FESTIVE2000",
    description: "Festive Refurbished Upgrade: Flat ₹2,000 Off",
    discountType: "fixed",
    discountValue: 2000,
    maxDiscount: 2000,
    minOrderAmount: 25000,
  },
];

async function seedMasterDatabase() {
  console.log("🚀 Starting FELCON Master Database Seed (125 Genuine 2022-2026 Products)...");

  // 1. Purge any legacy television records completely
  await Product.deleteMany({ category: "television" });
  await DeviceCatalog.deleteMany({ category: "television" });
  await EvaluationConfig.deleteMany({ category: "television" });
  await DeviceListing.deleteMany({ category: "television" });
  console.log("🧹 Completely purged any legacy television records from all collections.");

  // 2. Ensure Admin and Seller Users exist
  let admin = await User.findOne({ email: "admin@felcon.com" });
  if (!admin) {
    admin = await User.create({
      firstname: "FELCON",
      lastname: "Administrator",
      email: "admin@felcon.com",
      mobile: "+919999999999",
      role: "admin",
      isSuperSeller: true,
      accountStatus: "active",
      isVerified: true,
      defaultAddress: {
        street: "FELCON Headquarters, Tech Park",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        full: "FELCON HQ, Connaught Place, New Delhi 110001",
      },
    });
    console.log("✅ Created Admin User: admin@felcon.com");
  } else {
    admin.role = "admin";
    await admin.save();
    console.log("✅ Admin User confirmed: admin@felcon.com");
  }

  let seller = await User.findOne({ role: "seller" });
  if (!seller) {
    seller = await User.create({
      firstname: "FELCON",
      lastname: "Official",
      email: "official@felcon.com",
      mobile: "+919876543210",
      role: "seller",
      isSuperSeller: true,
      accountStatus: "active",
      isVerified: true,
      defaultAddress: {
        street: "FELCON Hub 1, Sector 62",
        city: "Noida",
        state: "Uttar Pradesh",
        pincode: "201309",
        full: "FELCON Refurbished Center, Sector 62, Noida 201309",
      },
    });
    console.log("✅ Created Official Seller: official@felcon.com");
  }

  // 3. Seed EvaluationConfigs for the 4 categories
  await EvaluationConfig.deleteMany({});
  await EvaluationConfig.insertMany(evaluationConfigs);
  console.log(`✅ Seeded EvaluationConfig for ${evaluationConfigs.length} categories!`);

  // 4. Seed Coupons
  await Coupon.deleteMany({});
  await Coupon.insertMany(defaultCoupons);
  console.log(`✅ Seeded ${defaultCoupons.length} Discount Coupons!`);

  // 5. Seed Product Collection with ALL 125 genuine released models (2022-2026)
  await Product.deleteMany({});

  const defaultLoc = { type: "Point", coordinates: [77.2090, 28.6139] };
  const defaultAddr = {
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    full: "Connaught Place, New Delhi",
  };

  const productDocs = ALL_GENUINE_PRODUCTS.map((p, idx) => ({
    ...p,
    listedBy: seller._id,
    listedByRole: "seller",
    location: defaultLoc,
    address: defaultAddr,
    status: "available",
    quantity: Math.floor(Math.random() * 8) + 8,
    inspectionCertified: true,
    inspectionRecord: {
      certifiedAt: new Date(Date.now() - (idx * 86400000)),
      inspectorName: `FELCON ${p.category.toUpperCase()} Lab · Senior QA`,
      passedPoints: 32,
      totalPoints: 32,
      grade: p.condition,
      batteryTestedHealth: p.batteryHealth,
      displayScore: "100% Functional OEM Display",
      chassisCondition:
        p.condition === "Like New"
          ? "Pristine / Flawless (0 marks)"
          : p.condition === "Superb"
          ? "Superb (Barely visible micro-marks)"
          : p.condition === "Good"
          ? "Good (Minor normal signs of use)"
          : "Fair (Noticeable exterior wear, 100% functional)",
    },
    warranty: p.warranty || "6 Months FELCON Assured Warranty + 7 Days Replacement",
    boxContents: p.boxContents || [
      "Certified Refurbished Device",
      "Fast Charging Cable / Adapter",
      "SIM Ejector Pin",
      "Warranty Card",
      "FELCON Eco-Box"
    ],
  }));

  await Product.insertMany(productDocs);
  console.log(`✅ Seeded ${productDocs.length} genuine 2022-2026 Products across 4 categories!`);

  // 6. Seed DeviceCatalog for Selling / Trade-In for ALL 4 Categories (1,065 Mobile + 115 Non-Mobile)
  const generateFullCatalog = require("./generateFullCatalog");
  const catalogDocs = generateFullCatalog();
  await DeviceCatalog.deleteMany({});
  await DeviceCatalog.insertMany(catalogDocs);
  console.log(`✅ Seeded DeviceCatalog for ${catalogDocs.length} brand-category groups across all 4 device types!`);

  // 7. Seed Initial Inspections
  const allFinalProducts = await Product.find({});
  await Inspection.deleteMany({});
  const sampleProducts = allFinalProducts.slice(0, 30);
  const inspections = sampleProducts.map((p, idx) => ({
    certificateId: `FLC-CERT-${2026000 + idx}`,
    product: p._id,
    deviceTitle: p.title,
    category: p.category,
    brand: p.brand,
    workflowStatus: "inventory_approved",
    batteryHealthPercentage: p.batteryHealth || 94,
    batteryCycleCount: Math.floor(Math.random() * 80) + 20,
    cosmeticCondition: p.condition,
    pointsPassed: 32,
    totalPoints: 32,
    inspectorName: "Senior Hardware Specialist · FELCON Lab",
    approvedByAdmin: true,
  }));
  await Inspection.insertMany(inspections);
  console.log(`✅ Seeded ${inspections.length} Device Quality Inspection Certificates!`);

  // Summary breakdown
  const categoryCounts = {};
  for (const p of allFinalProducts) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  const finalTotal = await Product.countDocuments();
  console.log(`🎉 Master Seed Complete! Total Products: ${finalTotal}`);
  console.log("📊 Breakdown by Category:", categoryCounts);
}

module.exports = seedMasterDatabase;

if (require.main === module) {
  const connectToDB = require("../config/db");
  connectToDB()
    .then(async () => {
      await seedMasterDatabase();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Master seed failed:", err);
      process.exit(1);
    });
}
