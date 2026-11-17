const mongoose = require("mongoose");

////////////////////////////////////////////////////////////////////
//// COMMISSION RATES
////////////////////////////////////////////////////////////////////

const COMMISSION_RATES = {
  seller: { min: 1, max: 1.5 }, // 1–1.5%
  user:   { min: 2, max: 2.5 }, // 2–2.5%
};

////////////////////////////////////////////////////////////////////
//// SCHEMA
////////////////////////////////////////////////////////////////////

const orderSchema = new mongoose.Schema(
  {
    ////////////////////////////////////////////////////////////////////
    //// PARTIES
    ////////////////////////////////////////////////////////////////////

    buyer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    buyerRole: {
      type: String,
      enum: ["seller", "user"],
    },

    seller: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    sellerRole: {
      type: String,
      enum: ["seller", "user", "admin"],
    },

    ////////////////////////////////////////////////////////////////////
    //// PRODUCT
    ////////////////////////////////////////////////////////////////////

     product: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Product",
      required: false, // null for sell requests — product created after seller confirms
      default:  null,
    },

    ////////////////////////////////////////////////////////////////////
    //// TRANSACTION TYPE
    //// buy  → buyer purchases product from seller
    //// sell → user sells their device to a seller
    ////////////////////////////////////////////////////////////////////

    transactionType: {
      type:     String,
      enum:     ["buy", "sell"],
      required: true,
    },

    ////////////////////////////////////////////////////////////////////
    //// PRICING + COMMISSION
    ////////////////////////////////////////////////////////////////////

    salePrice: {
      type:     Number,
      required: true,
    },

    // Commission rate applied (1-2.5% depending on buyer role)
    commissionRate: {
      type:     Number,
      required: true,
    },

    // Actual commission amount paid to admin
    commissionAmount: {
      type:     Number,
      required: true,
    },

    // What the seller receives after commission deduction
    sellerEarnings: {
      type:     Number,
      required: true,
    },

    ////////////////////////////////////////////////////////////////////
    //// PAYMENT
    ////////////////////////////////////////////////////////////////////

    paymentMethod: {
      type:    String,
      enum:    ["Cash", "UPI", "Card", "NetBanking"],
      default: null,
    },

    paymentStatus: {
      type:    String,
      enum:    ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },

    paymentId: {
      type:    String,
      default: null,
    },

    ////////////////////////////////////////////////////////////////////
    //// ORDER STATUS & TRACKING (Cashify 7-stage order lifecycle)
    ////////////////////////////////////////////////////////////////////

    status: {
      type:    String,
      enum:    [
        "pending",
        "confirmed",
        "processing",
        "quality_check",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected"
      ],
      default: "confirmed",
    },

    courier: {
      partner: { type: String, default: "BlueDart Express" },
      trackingId: { type: String, default: null },
      estimatedDelivery: { type: Date, default: null },
      shippedAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
    },

    statusHistory: [
      {
        status: { type: String },
        label: { type: String },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],

    shippingAddress: {
      street: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      pincode: { type: String, default: null },
      full: { type: String, default: null },
      contactPhone: { type: String, default: null },
    },

    // Trade-in / Exchange support
    exchange: {
      isExchange: { type: Boolean, default: false },
      device: { type: String, default: null },
      value: { type: Number, default: 0 },
      status: { type: String, enum: ["pending_pickup", "inspected", "completed", "cancelled", null], default: null },
    },

    // Coupon applied
    coupon: {
      code: { type: String, default: null },
      discountAmount: { type: Number, default: 0 },
    },

    // For sell requests — seller notes about the device
    sellerNote: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true }
);

////////////////////////////////////////////////////////////////////
//// INDEXES
////////////////////////////////////////////////////////////////////

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ product: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ transactionType: 1 });

const OrderModel = mongoose.model("Order", orderSchema);

OrderModel.COMMISSION_RATES = COMMISSION_RATES;

module.exports = OrderModel;