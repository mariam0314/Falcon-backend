const mongoose = require("mongoose");

const inspectionPointSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true }, // "Display", "Battery", "Camera", "Audio", "Chassis", "Connectivity", "Sensors"
    passed: { type: Boolean, default: true },
    remark: { type: String, default: "Passed" },
  },
  { _id: false }
);

const inspectionSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    deviceTitle: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    serialNumber: {
      type: String,
      default: () => "FLC-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
    },
    imei: {
      type: String,
      default: () => "86" + Math.floor(1000000000000 + Math.random() * 9000000000000),
    },

    // 14 workflow steps
    workflowStatus: {
      type: String,
      enum: [
        "device_received",
        "initial_inspection",
        "hardware_testing",
        "display_testing",
        "battery_testing",
        "camera_testing",
        "audio_testing",
        "connectivity_testing",
        "port_testing",
        "physical_damage_inspection",
        "repairs_and_replacements",
        "cleaning_and_sanitisation",
        "final_quality_testing",
        "inventory_approved"
      ],
      default: "inventory_approved",
    },

    batteryHealthPercentage: {
      type: Number,
      default: 94,
      min: 50,
      max: 100,
    },
    batteryCycleCount: {
      type: Number,
      default: 45,
    },

    displayQuality: {
      type: String,
      default: "Grade A OEM Display - 100% Touch & TrueTone/ProMotion Functional",
    },

    cosmeticCondition: {
      type: String,
      enum: ["Like New", "Superb", "Good", "Fair"],
      default: "Superb",
    },

    pointsPassed: {
      type: Number,
      default: 32,
    },
    totalPoints: {
      type: Number,
      default: 32,
    },

    checklist: [inspectionPointSchema],

    repairsDone: {
      type: [String],
      default: ["Sanitized with Medical-Grade UV", "OEM Battery Health Calibrated", "Acoustic Chamber Test Passed"],
    },

    inspectorName: {
      type: String,
      default: "Senior Technician · FELCON Lab Delhi",
    },
    inspectedAt: {
      type: Date,
      default: Date.now,
    },
    approvedByAdmin: {
      type: Boolean,
      default: true,
    },
    warrantyMonths: {
      type: Number,
      default: 6,
    },
  },
  { timestamps: true }
);

inspectionSchema.index({ product: 1 });

module.exports = mongoose.model("Inspection", inspectionSchema);
