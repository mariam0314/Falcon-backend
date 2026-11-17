const mongoose       = require("mongoose");
const ProductService = require("../services/product.service");
const OrderModel     = require("../models/order.model");
const Coupon         = require("../models/coupon.model");
const emailService   = require("../services/email.service");

const COMMISSION_RATES = OrderModel.COMMISSION_RATES;

const VALID_PAYMENT_METHODS = ["Cash", "UPI", "Card", "NetBanking"];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isValidPaymentMethod(method) {
  return VALID_PAYMENT_METHODS.includes(method);
}

function calculateCommission(price, role) {
  const rates  = COMMISSION_RATES[role];
  const rate   = (rates.min + rates.max) / 2;
  const amount = parseFloat(((price * rate) / 100).toFixed(2));
  return { rate, amount };
}

const BUYER_FIELDS  = "firstname lastname email mobile phone defaultAddress";
const SELLER_FIELDS = "firstname lastname email defaultAddress";


// ─── PLACE BUY ORDER ──────────────────────────────────────────────────────────
// POST /products/:id/buy
exports.buyProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const { paymentMethod, paymentId, shippingAddress, couponCode, exchange } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        message:        "Payment method is required",
        allowedMethods: VALID_PAYMENT_METHODS,
      });
    }

    if (!isValidPaymentMethod(paymentMethod)) {
      return res.status(400).json({
        message:        `Invalid payment method "${paymentMethod}". Allowed: ${VALID_PAYMENT_METHODS.join(", ")}`,
        allowedMethods: VALID_PAYMENT_METHODS,
      });
    }

    const product = await ProductService.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.status !== "available") {
      return res.status(400).json({ message: "This product is no longer available" });
    }

    if (product.listedBy._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot buy your own product" });
    }

    const buyerRole  = req.user.role;
    const sellerRole = product.listedByRole;

    if (buyerRole === "user" && sellerRole !== "seller" && sellerRole !== "admin") {
      return res.status(403).json({
        message: "Users can only purchase products listed by sellers or admin",
        code:    "INVALID_TRANSACTION",
      });
    }

    // ── Coupon deduction ──────────────────────────────────────────────────
    let couponData = { code: null, discountAmount: 0 };
    if (couponCode) {
      const foundCoupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        isActive: true,
      });
      if (foundCoupon && (!foundCoupon.expiresAt || new Date(foundCoupon.expiresAt) > new Date())) {
        if (product.price >= (foundCoupon.minOrderAmount || 0)) {
          let disc = 0;
          if (foundCoupon.discountType === "percentage") {
            disc = (product.price * foundCoupon.discountValue) / 100;
            if (foundCoupon.maxDiscount) disc = Math.min(disc, foundCoupon.maxDiscount);
          } else {
            disc = foundCoupon.discountValue;
          }
          disc = Math.min(disc, product.price);
          couponData = {
            code: foundCoupon.code,
            discountAmount: Math.round(disc),
          };
          await Coupon.findByIdAndUpdate(foundCoupon._id, { $inc: { timesUsed: 1 } });
        }
      }
    }

    // ── Exchange / Trade-in deduction ─────────────────────────────────────
    let exchangeData = {
      isExchange: false,
      device: null,
      value: 0,
      status: null,
    };
    if (exchange && (exchange.isExchange || exchange.device) && Number(exchange.value) > 0) {
      exchangeData = {
        isExchange: true,
        device: exchange.device || "Trade-in Device",
        value: Number(exchange.value),
        status: "pending_pickup",
      };
    }

    const finalPayable = Math.max(0, product.price - couponData.discountAmount - exchangeData.value);

    const { rate, amount } = calculateCommission(finalPayable > 0 ? finalPayable : product.price, buyerRole);
    const sellerEarnings   = parseFloat(Math.max(0, (finalPayable > 0 ? finalPayable : product.price) - amount).toFixed(2));

    // ── Shipping Address ──────────────────────────────────────────────────
    const resolvedAddress = {
      street: shippingAddress?.street || shippingAddress?.address || req.user.defaultAddress?.street || "Default Delivery Street",
      city: shippingAddress?.city || req.user.defaultAddress?.city || "New Delhi",
      state: shippingAddress?.state || req.user.defaultAddress?.state || "Delhi",
      pincode: shippingAddress?.pincode || req.user.defaultAddress?.pincode || "110001",
      full: shippingAddress?.full || (shippingAddress ? `${shippingAddress.street || shippingAddress.address || ""}, ${shippingAddress.city || ""}, ${shippingAddress.state || ""} - ${shippingAddress.pincode || ""}` : null),
      contactPhone: shippingAddress?.contactPhone || shippingAddress?.phone || req.user.phone || req.user.mobile || "9876543210",
    };

    // ── Tracking & Courier Setup ──────────────────────────────────────────
    const trackingId = "FEL-" + Math.floor(10000000 + Math.random() * 90000000);
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const courier = {
      partner: "BlueDart Express",
      trackingId,
      estimatedDelivery,
      shippedAt: null,
      deliveredAt: null,
    };

    const initialHistory = [
      {
        status: "confirmed",
        label: "Order Confirmed",
        timestamp: new Date(),
        note: "Order placed & verified. Payment processed via " + paymentMethod + ".",
      },
    ];

    const order = await OrderModel.create({
      buyer:            req.user._id,
      buyerRole,
      seller:           product.listedBy._id,
      sellerRole,
      product:          product._id,
      transactionType:  "buy",
      salePrice:        finalPayable,
      commissionRate:   rate,
      commissionAmount: amount,
      sellerEarnings,
      paymentMethod,
      paymentId:        paymentId || ("PAY-" + Math.floor(10000000 + Math.random() * 90000000)),
      paymentStatus:    "completed",
      paidAt:           new Date(),
      status:           "confirmed",
      courier,
      statusHistory:    initialHistory,
      shippingAddress:  resolvedAddress,
      exchange:         exchangeData,
      coupon:           couponData,
    });

    await ProductService.markAsSold(product._id);

    // ── Email: notify buyer that order was placed & confirmed ─────────────
    emailService.sendOrderPlacedEmail(req.user.email, {
      buyerName:   `${req.user.firstname} ${req.user.lastname}`,
      orderId:     order._id,
      productTitle: product.title,
      price:       finalPayable,
      paymentMethod,
    }).catch((err) => console.error("sendOrderPlacedEmail error:", err));

    // ── Email: notify seller of new order ──────────────────────────────────
    const seller = product.listedBy;
    if (seller.email) {
      emailService.sendNewOrderNotificationEmail(seller.email, {
        sellerName:   `${seller.firstname} ${seller.lastname}`,
        orderId:      order._id,
        productTitle: product.title,
        price:        finalPayable,
        buyerName:    `${req.user.firstname} ${req.user.lastname}`,
        buyerEmail:   req.user.email,
        paymentMethod,
      }).catch((err) => console.error("sendNewOrderNotificationEmail error:", err));
    }

    res.status(201).json({
      success: true,
      message: "Order placed and confirmed successfully! Verified FELCON refurbished device is being prepared.",
      data: {
        orderId:       order._id,
        status:        "confirmed",
        paymentStatus: "completed",
        paymentMethod,
        paidAt:        order.paidAt,
        courier,
        shippingAddress: resolvedAddress,
        exchange:      exchangeData,
        coupon:        couponData,
        product: {
          id:    product._id,
          title: product.title,
          price: product.price,
          brand: product.brand,
          condition: product.condition,
        },
        breakdown: {
          originalPrice:    product.price,
          couponDiscount:   couponData.discountAmount,
          exchangeDiscount: exchangeData.value,
          commissionRate:   `${rate}%`,
          commissionAmount: amount,
          totalPaid:        finalPayable,
          sellerReceives:   sellerEarnings,
        },
      },
    });
  } catch (error) {
    console.error("buyProduct error:", error);
    res.status(500).json({ message: "Purchase failed. Please try again" });
  }
};


// ─── CONFIRM BUY ORDER ────────────────────────────────────────────────────────
// POST /orders/:orderId/confirm
exports.confirmBuyOrder = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await OrderModel.findOne({
      _id:             req.params.orderId,
      seller:          req.user._id,
      transactionType: "buy",
      status:          "pending",
    })
      .populate("product", "title price images status")
      .populate("buyer",   BUYER_FIELDS)
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found, already processed, or you are not the seller",
      });
    }

    const confirmedOrder = await OrderModel.findByIdAndUpdate(
      order._id,
      {
        status:        "confirmed",
        paymentStatus: "completed",
        confirmedAt:   new Date(),
      },
      { new: true }
    )
      .populate("product", "title price images")
      .populate("buyer",   BUYER_FIELDS)
      .populate("seller",  SELLER_FIELDS)
      .lean();

    await ProductService.markAsSold(order.product._id);

    // ── Email: notify buyer that seller confirmed ──────────────────────────
    if (order.buyer?.email) {
      emailService.sendOrderConfirmedEmail(order.buyer.email, {
        buyerName:   `${order.buyer.firstname} ${order.buyer.lastname}`,
        orderId:     order._id,
        productTitle: order.product.title,
        price:       order.product.price,
        sellerName:  `${req.user.firstname} ${req.user.lastname}`,
        confirmedAt: confirmedOrder.confirmedAt,
      }).catch((err) => console.error("sendOrderConfirmedEmail error:", err));
    }

    res.status(200).json({
      success: true,
      message: `Order confirmed. ${order.buyer.firstname}'s purchase is now complete.`,
      data: {
        orderId:       confirmedOrder._id,
        status:        "confirmed",
        confirmedAt:   confirmedOrder.confirmedAt,
        buyer: {
          name:  `${order.buyer.firstname} ${order.buyer.lastname}`,
          email: order.buyer.email,
        },
        product: {
          title: order.product.title,
          price: order.product.price,
        },
        earnings: confirmedOrder.sellerEarnings,
      },
    });
  } catch (error) {
    console.error("confirmBuyOrder error:", error);
    res.status(500).json({ message: "Failed to confirm order" });
  }
};


// ─── REJECT BUY ORDER ─────────────────────────────────────────────────────────
// POST /orders/:orderId/reject
exports.rejectBuyOrder = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const { reason } = req.body;

    const order = await OrderModel.findOne({
      _id:             req.params.orderId,
      seller:          req.user._id,
      transactionType: "buy",
      status:          "pending",
    })
      .populate("buyer",   BUYER_FIELDS)
      .populate("product", "title")
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found, already processed, or you are not the seller",
      });
    }

    await OrderModel.findByIdAndUpdate(order._id, {
      status:          "rejected",
      rejectedAt:      new Date(),
      rejectionReason: reason?.trim() || null,
    });

    await ProductService.markAsAvailable(order.product._id);

    // ── Email: notify buyer that order was rejected ────────────────────────
    if (order.buyer?.email) {
      emailService.sendOrderRejectedEmail(order.buyer.email, {
        buyerName:    `${order.buyer.firstname} ${order.buyer.lastname}`,
        orderId:      order._id,
        productTitle: order.product.title,
        reason:       reason?.trim() || null,
      }).catch((err) => console.error("sendOrderRejectedEmail error:", err));
    }

    res.status(200).json({
      success: true,
      message: "Order request rejected. Product is available again.",
      data: {
        orderId:    order._id,
        status:     "rejected",
        rejectedAt: new Date(),
        reason:     reason?.trim() || null,
      },
    });
  } catch (error) {
    console.error("rejectBuyOrder error:", error);
    res.status(500).json({ message: "Failed to reject order" });
  }
};


// ─── CANCEL BUY ORDER ─────────────────────────────────────────────────────────
// POST /orders/:orderId/cancel
exports.cancelBuyOrder = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await OrderModel.findOne({
      _id:             req.params.orderId,
      buyer:           req.user._id,
      transactionType: "buy",
      status:          "pending",
    })
      .populate("product", "title _id")
      .populate("seller",  SELLER_FIELDS)
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found or cannot be cancelled (already confirmed or rejected)",
      });
    }

    await OrderModel.findByIdAndUpdate(order._id, {
      status:      "cancelled",
      cancelledAt: new Date(),
    });

    await ProductService.markAsAvailable(order.product._id);

    // ── Email: notify seller that buyer cancelled ──────────────────────────
    if (order.seller?.email) {
      emailService.sendOrderCancelledEmail(order.seller.email, {
        sellerName:   `${order.seller.firstname} ${order.seller.lastname}`,
        orderId:      order._id,
        productTitle: order.product.title,
      }).catch((err) => console.error("sendOrderCancelledEmail error:", err));
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully. Product is available again.",
      data: {
        orderId:     order._id,
        status:      "cancelled",
        cancelledAt: new Date(),
      },
    });
  } catch (error) {
    console.error("cancelBuyOrder error:", error);
    res.status(500).json({ message: "Failed to cancel order" });
  }
};


// ─── GET MY ORDERS ────────────────────────────────────────────────────────────
// GET /orders/my?type=buy&status=pending&page=1&limit=10
exports.getMyOrders = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;

    const filter = {
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    };
    if (type)   filter.transactionType = type;
    if (status) filter.status          = status;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("product", "title images price brand")
        .populate("buyer",   BUYER_FIELDS)
        .populate("seller",  SELLER_FIELDS)
        .lean(),
      OrderModel.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext:    pageNum < Math.ceil(total / limitNum),
        hasPrev:    pageNum > 1,
      },
    });
  } catch (error) {
    console.error("getMyOrders error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};


// ─── GET PENDING ORDERS FOR SELLER ────────────────────────────────────────────
// GET /orders/pending
exports.getSellerPendingOrders = async (req, res) => {
  try {
    const orders = await OrderModel.find({
      seller:          req.user._id,
      transactionType: "buy",
      status:          "pending",
    })
      .sort({ createdAt: -1 })
      .populate("product", "title images price condition brand")
      .populate("buyer",   BUYER_FIELDS)
      .lean();

    res.status(200).json({
      success: true,
      count:   orders.length,
      orders,
    });
  } catch (error) {
    console.error("getSellerPendingOrders error:", error);
    res.status(500).json({ message: "Failed to fetch pending orders" });
  }
};


// ─── UPDATE ORDER STATUS ──────────────────────────────────────────────────────
// PATCH /orders/:orderId/status
exports.updateOrderStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const { status } = req.body;

    const allowedStatuses = ["pending", "confirmed", "completed", "cancelled", "delivered", "rejected", "shipped"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status value",
        allowedStatuses,
      });
    }

    const order = await OrderModel.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isBuyer  = order.buyer.toString()  === req.user._id.toString();
    const isSeller = order.seller.toString() === req.user._id.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: "You are not allowed to update this order" });
    }

    if (order.status === "completed" || order.status === "cancelled") {
      return res.status(400).json({ message: "Finalized orders cannot be updated" });
    }

    order.status = status;
    await order.save();

    const updatedOrder = await OrderModel.findById(order._id)
      .populate("product", "title price brand images")
      .populate("buyer",   BUYER_FIELDS)
      .populate("seller",  SELLER_FIELDS)
      .lean();

    // ── Email: notify on shipped ───────────────────────────────────────────
    if (status === "shipped" && updatedOrder.buyer?.email) {
      emailService.sendOrderShippedEmail(updatedOrder.buyer.email, {
        buyerName:    `${updatedOrder.buyer.firstname} ${updatedOrder.buyer.lastname}`,
        orderId:      updatedOrder._id,
        productTitle: updatedOrder.product.title,
        price:        updatedOrder.product.price,
        sellerName:   `${updatedOrder.seller.firstname} ${updatedOrder.seller.lastname}`,
        shippedAt:    new Date(),
      }).catch((err) => console.error("sendOrderShippedEmail error:", err));
    }

    // ── Email: notify buyer AND seller on delivered ────────────────────────
    if (status === "delivered") {
      if (updatedOrder.buyer?.email) {
        emailService.sendOrderDeliveredToBuyerEmail(updatedOrder.buyer.email, {
          buyerName:    `${updatedOrder.buyer.firstname} ${updatedOrder.buyer.lastname}`,
          orderId:      updatedOrder._id,
          productTitle: updatedOrder.product.title,
          price:        updatedOrder.product.price,
          sellerName:   `${updatedOrder.seller.firstname} ${updatedOrder.seller.lastname}`,
          deliveredAt:  new Date(),
        }).catch((err) => console.error("sendOrderDeliveredToBuyerEmail error:", err));
      }

      if (updatedOrder.seller?.email) {
        emailService.sendOrderDeliveredToSellerEmail(updatedOrder.seller.email, {
          sellerName:   `${updatedOrder.seller.firstname} ${updatedOrder.seller.lastname}`,
          orderId:      updatedOrder._id,
          productTitle: updatedOrder.product.title,
          earnings:     updatedOrder.sellerEarnings,
          deliveredAt:  new Date(),
        }).catch((err) => console.error("sendOrderDeliveredToSellerEmail error:", err));
      }
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to "${status}"`,
      data:    updatedOrder,
    });
  } catch (error) {
    console.error("updateOrderStatus error:", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
};


// ─── VALIDATE & APPLY COUPON ─────────────────────────────────────────────────
// POST /orders/apply-coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { code, amount, orderAmount: explicitAmount } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const orderAmount = Number(amount ?? explicitAmount) || 0;
    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid or inactive coupon code" });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: "This coupon code has expired" });
    }

    if (orderAmount < (coupon.minOrderAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${(coupon.minOrderAmount || 0).toLocaleString("en-IN")} required for this coupon`,
      });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    } else {
      discount = coupon.discountValue;
    }

    discount = Math.min(discount, orderAmount);
    discount = Math.round(discount);

    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" applied! You saved ₹${discount.toLocaleString("en-IN")}`,
      data: {
        code: coupon.code,
        description: coupon.description,
        discountAmount: discount,
        finalAmount: Math.max(0, orderAmount - discount),
      },
    });
  } catch (err) {
    console.error("applyCoupon error:", err);
    res.status(500).json({ success: false, message: "Failed to validate coupon" });
  }
};


// ─── TRACK ORDER (7 Stages) ──────────────────────────────────────────────────
// GET /orders/:orderId/track
exports.trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await OrderModel.findById(orderId)
      .populate("product", "title brand category images price condition storage color")
      .populate("buyer", BUYER_FIELDS)
      .populate("seller", SELLER_FIELDS)
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const userId = req.user._id.toString();
    const isBuyer = order.buyer?._id?.toString() === userId;
    const isSeller = order.seller?._id?.toString() === userId;
    const isAdmin = req.user.role === "admin";

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const STAGES = [
      { key: "confirmed", label: "Order Confirmed", desc: "Your refurbished order has been placed and confirmed." },
      { key: "processing", label: "Processing", desc: "FELCON fulfillment center is preparing your package." },
      { key: "quality_check", label: "Quality Check", desc: "32-point final diagnostic and sanitization passed." },
      { key: "packed", label: "Packed", desc: "Carefully sealed in tamper-proof FELCON eco-packaging." },
      { key: "shipped", label: "Shipped", desc: "Package handed over to BlueDart Express." },
      { key: "out_for_delivery", label: "Out for Delivery", desc: "Delivery executive is on the way to your address." },
      { key: "delivered", label: "Delivered", desc: "Package successfully handed over to you." },
    ];

    const currentStatusIndex = STAGES.findIndex((s) => s.key === order.status);

    const timeline = STAGES.map((stage, idx) => {
      const historyItem = (order.statusHistory || []).find((h) => h.status === stage.key);
      return {
        key: stage.key,
        label: stage.label,
        description: stage.desc,
        isCompleted: currentStatusIndex >= idx && currentStatusIndex !== -1,
        isCurrent: order.status === stage.key,
        timestamp: historyItem ? historyItem.timestamp : null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        order,
        timeline,
        currentStage: order.status,
        courier: order.courier,
        shippingAddress: order.shippingAddress,
      },
    });
  } catch (err) {
    console.error("trackOrder error:", err);
    res.status(500).json({ success: false, message: "Failed to track order" });
  }
};
