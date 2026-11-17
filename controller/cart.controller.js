const mongoose   = require("mongoose");
const UserModel  = require("../models/user.model");
const Product    = require("../models/product.model");
const Coupon     = require("../models/coupon.model");
const OrderModel = require("../models/order.model");

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─── ADD TO CART ───────────────────────────────────────────────────────────
// POST /api/cart/:productId

exports.addToCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const quantity      = Math.max(1, parseInt(req.body?.quantity, 10) || 1);
    const userId        = req.user._id;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.status !== "available") {
      return res.status(400).json({ message: "Product is no longer available" });
    }

    if (product.listedBy && product.listedBy.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot add your own product to cart" });
    }

    const user = await UserModel.findById(userId).select("cart");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const cart = user.cart || [];
    const existingIndex = cart.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + quantity;
      user.cart = cart;
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Cart quantity updated",
        quantity: cart[existingIndex].quantity,
      });
    }

    cart.push({ product: productId, quantity, addedAt: new Date() });
    user.cart = cart;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      quantity,
    });
  } catch (error) {
    console.error("addToCart error:", error);
    res.status(500).json({ message: "Failed to add to cart" });
  }
};

// ─── UPDATE QUANTITY ───────────────────────────────────────────────────────
// PUT /api/cart/:productId/quantity

exports.updateQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const quantity      = parseInt(req.body?.quantity, 10);
    const userId        = req.user._id;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const user = await UserModel.findById(userId).select("cart");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const cart = user.cart || [];
    const itemIndex = cart.findIndex((i) => i.product.toString() === productId);

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (quantity <= 0) {
      cart.splice(itemIndex, 1);
    } else {
      cart[itemIndex].quantity = quantity;
    }

    user.cart = cart;
    await user.save();

    res.status(200).json({
      success: true,
      message: quantity <= 0 ? "Product removed from cart" : "Quantity updated",
    });
  } catch (error) {
    console.error("updateQuantity error:", error);
    res.status(500).json({ message: "Failed to update quantity" });
  }
};

// ─── GET CART ──────────────────────────────────────────────────────────────
// GET /api/cart
// Returns full product details for all cart items

exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await UserModel.findById(userId)
      .select("cart")
      .populate({
        path:   "cart.product",
        select: "title brand category deviceType condition storage color price originalPrice images status address specs listedByRole createdAt",
        match:  { status: "available" },  // only show still-available products
      })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter out items whose product was deleted or is no longer available
    const cartItems = (user.cart || [])
      .filter((item) => item.product !== null)
      .map((item) => ({
        product: item.product,
        quantity: item.quantity || 1,
        addedAt: item.addedAt,
      }));

    // Calculate cart total
    const total = cartItems.reduce(
      (sum, item) => sum + (item.product?.price || 0) * (item.quantity || 1),
      0
    );

    res.status(200).json({
      success: true,
      count:   cartItems.length,
      total,
      data:    cartItems,
    });
  } catch (error) {
    console.error("getCart error:", error);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};


// ─── REMOVE FROM CART ──────────────────────────────────────────────────────
// DELETE /api/cart/:productId

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId        = req.user._id;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    await UserModel.findByIdAndUpdate(userId, {
      $pull: { cart: { product: productId } },
    });

    res.status(200).json({
      success: true,
      message: "Product removed from cart",
    });
  } catch (error) {
    console.error("removeFromCart error:", error);
    res.status(500).json({ message: "Failed to remove from cart" });
  }
};


// ─── CLEAR CART ────────────────────────────────────────────────────────────
// DELETE /api/cart

exports.clearCart = async (req, res) => {
  try {
    await UserModel.findByIdAndUpdate(req.user._id, {
      $set: { cart: [] },
    });

    res.status(200).json({
      success: true,
      message: "Cart cleared",
    });
  } catch (error) {
    console.error("clearCart error:", error);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};


// ─── CHECK IF PRODUCT IS IN CART ───────────────────────────────────────────
// GET /api/cart/:productId/check

exports.checkCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId        = req.user._id;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const user = await UserModel.findById(userId).select("cart").lean();
    const cart     = user?.cart || [];   
    const isInCart = user.cart.some(
      (item) => item.product.toString() === productId
    );

    res.status(200).json({
      success: true,
      isInCart,
    });
  } catch (error) {
    console.error("checkCart error:", error);
    res.status(500).json({ message: "Failed to check cart" });
  }
};


// ─── CHECKOUT FROM CART ────────────────────────────────────────────────────
// POST /api/cart/:productId/checkout
// Moves a single cart item into an order (calls the same buy flow)
// User picks paymentMethod at checkout time

exports.checkoutFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId        = req.user._id;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const { paymentMethod, paymentId, shippingAddress, couponCode, exchange } = req.body;
    const VALID_METHODS = ["Cash", "UPI", "Card", "NetBanking"];

    if (!paymentMethod) {
      return res.status(400).json({
        message:        "Payment method is required",
        allowedMethods: VALID_METHODS,
      });
    }

    if (!VALID_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        message:        `Invalid payment method. Allowed: ${VALID_METHODS.join(", ")}`,
        allowedMethods: VALID_METHODS,
      });
    }

    // Check product is still in cart
    const user = await UserModel.findById(userId).select("cart").lean();
    const cart = user?.cart || [];      
    const inCart = cart.some(
      (item) => item.product.toString() === productId
    );

    if (!inCart) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    // Check product is still available
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.status !== "available") {
      // Auto-remove from cart since it's no longer available
      await UserModel.findByIdAndUpdate(userId, {
        $pull: { cart: { product: productId } },
      });
      return res.status(400).json({
        message: "Product is no longer available and has been removed from your cart",
      });
    }

    const ProductService   = require("../service/product.service");
    const COMMISSION_RATES = OrderModel.COMMISSION_RATES;

    function calculateCommission(price, role) {
      const rates  = COMMISSION_RATES[role] || COMMISSION_RATES.user;
      const rate   = (rates.min + rates.max) / 2;
      const amount = parseFloat(((price * rate) / 100).toFixed(2));
      return { rate, amount };
    }

    if (product.listedBy.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot buy your own product" });
    }

    const buyerRole  = req.user.role;
    const sellerRole = product.listedByRole;

    if (buyerRole === "user" && sellerRole !== "seller" && sellerRole !== "admin") {
      return res.status(403).json({
        message: "Users can only purchase products listed by sellers or admin",
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
        note: "Order placed & confirmed from cart via " + paymentMethod + ".",
      },
    ];

    const order = await OrderModel.create({
      buyer:            userId,
      buyerRole,
      seller:           product.listedBy,
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

    // Mark as sold
    await ProductService.markAsSold(product._id);

    // Remove from cart after order placed
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { cart: { product: productId } },
    });

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
    console.error("checkoutFromCart error:", error);
    res.status(500).json({ message: "Failed to checkout. Please try again" });
  }
};

// ─── CHECKOUT ALL ITEMS FROM CART ─────────────────────────────────────────
// POST /api/cart/checkout
// body: { paymentMethod, shippingAddress, couponCode }
// Checks out ALL products currently in cart

exports.checkoutMultiple = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentMethod, paymentId, shippingAddress, couponCode, exchange } = req.body;

    const VALID_METHODS = ["Cash", "UPI", "Card", "NetBanking"];

    if (!paymentMethod) {
      return res.status(400).json({
        message:        "Payment method is required",
        allowedMethods: VALID_METHODS,
      });
    }

    if (!VALID_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        message:        `Invalid payment method. Allowed: ${VALID_METHODS.join(", ")}`,
        allowedMethods: VALID_METHODS,
      });
    }

    // ── Fetch cart ──────────────────────────────────────────────────────────
    const user = await UserModel.findById(userId).select("cart").lean();
    const cart = user?.cart || [];

    if (cart.length === 0) {
      return res.status(400).json({ message: "Your cart is empty" });
    }

    const productIds = cart.map((item) => item.product.toString());

    // ── Fetch all products in parallel ──────────────────────────────────────
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    // ── Validate each product ───────────────────────────────────────────────
    const unavailable = [];
    const ownProducts = [];
    const invalidRole = [];

    for (const product of products) {
      if (product.status !== "available") {
        unavailable.push(product._id.toString());
      }
      if (product.listedBy.toString() === userId.toString()) {
        ownProducts.push(product._id.toString());
      }
      if (product.listedByRole !== "seller" && product.listedByRole !== "admin") {
        invalidRole.push(product._id.toString());
      }
    }

    // Auto remove unavailable products from cart silently
    if (unavailable.length > 0) {
      await UserModel.findByIdAndUpdate(userId, {
        $pull: { cart: { product: { $in: unavailable } } },
      });
    }

    const validProducts = products.filter(
      (p) =>
        p.status === "available" &&
        p.listedBy.toString() !== userId.toString() &&
        (p.listedByRole === "seller" || p.listedByRole === "admin")
    );

    if (validProducts.length === 0) {
      return res.status(400).json({
        message: "No valid products to checkout",
        errors: {
          ...(unavailable.length > 0 && {
            unavailable: {
              ids:     unavailable,
              message: "No longer available — removed from cart",
            },
          }),
          ...(ownProducts.length > 0 && {
            ownProducts: {
              ids:     ownProducts,
              message: "You cannot buy your own products",
            },
          }),
          ...(invalidRole.length > 0 && {
            invalidRole: {
              ids:     invalidRole,
              message: "Products must be listed by verified sellers or FELCON admin",
            },
          }),
        },
      });
    }

    const ProductService   = require("../service/product.service");
    const COMMISSION_RATES = OrderModel.COMMISSION_RATES;

    function calculateCommission(price, role) {
      const rates  = COMMISSION_RATES[role] || COMMISSION_RATES.user;
      const rate   = (rates.min + rates.max) / 2;
      const amount = parseFloat(((price * rate) / 100).toFixed(2));
      return { rate, amount };
    }

    // ── Coupon calculation across cart ────────────────────────────────────
    const cartSubtotal = validProducts.reduce((sum, p) => sum + p.price, 0);
    let couponData = { code: null, discountAmount: 0 };
    if (couponCode) {
      const foundCoupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        isActive: true,
      });
      if (foundCoupon && (!foundCoupon.expiresAt || new Date(foundCoupon.expiresAt) > new Date())) {
        if (cartSubtotal >= (foundCoupon.minOrderAmount || 0)) {
          let disc = 0;
          if (foundCoupon.discountType === "percentage") {
            disc = (cartSubtotal * foundCoupon.discountValue) / 100;
            if (foundCoupon.maxDiscount) disc = Math.min(disc, foundCoupon.maxDiscount);
          } else {
            disc = foundCoupon.discountValue;
          }
          disc = Math.min(disc, cartSubtotal);
          couponData = {
            code: foundCoupon.code,
            discountAmount: Math.round(disc),
          };
          await Coupon.findByIdAndUpdate(foundCoupon._id, { $inc: { timesUsed: 1 } });
        }
      }
    }

    const buyerRole = req.user.role;
    const now       = new Date();

    const resolvedAddress = {
      street: shippingAddress?.street || shippingAddress?.address || req.user.defaultAddress?.street || "Default Delivery Street",
      city: shippingAddress?.city || req.user.defaultAddress?.city || "New Delhi",
      state: shippingAddress?.state || req.user.defaultAddress?.state || "Delhi",
      pincode: shippingAddress?.pincode || req.user.defaultAddress?.pincode || "110001",
      full: shippingAddress?.full || (shippingAddress ? `${shippingAddress.street || shippingAddress.address || ""}, ${shippingAddress.city || ""}, ${shippingAddress.state || ""} - ${shippingAddress.pincode || ""}` : null),
      contactPhone: shippingAddress?.contactPhone || shippingAddress?.phone || req.user.phone || req.user.mobile || "9876543210",
    };

    let remainingDiscount = couponData.discountAmount;

    const orderResults = await Promise.all(
      validProducts.map(async (product, idx) => {
        // Distribute coupon discount among items
        let itemDiscount = 0;
        if (idx === validProducts.length - 1) {
          itemDiscount = remainingDiscount;
        } else {
          itemDiscount = Math.round((product.price / cartSubtotal) * couponData.discountAmount);
          remainingDiscount = Math.max(0, remainingDiscount - itemDiscount);
        }

        const finalItemPrice = Math.max(0, product.price - itemDiscount);
        const { rate, amount } = calculateCommission(finalItemPrice, buyerRole);
        const sellerEarnings   = parseFloat(Math.max(0, finalItemPrice - amount).toFixed(2));

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
            timestamp: now,
            note: "Order placed & confirmed via " + paymentMethod + ".",
          },
        ];

        const order = await OrderModel.create({
          buyer:            userId,
          buyerRole,
          seller:           product.listedBy,
          sellerRole:       product.listedByRole,
          product:          product._id,
          transactionType:  "buy",
          salePrice:        finalItemPrice,
          commissionRate:   rate,
          commissionAmount: amount,
          sellerEarnings,
          paymentMethod,
          paymentId:        paymentId || ("PAY-" + Math.floor(10000000 + Math.random() * 90000000)),
          paymentStatus:    "completed",
          paidAt:           now,
          status:           "confirmed",
          courier,
          statusHistory:    initialHistory,
          shippingAddress:  resolvedAddress,
          coupon: {
            code: couponData.code,
            discountAmount: itemDiscount,
          },
        });

        await ProductService.markAsSold(product._id);

        return {
          orderId:       order._id,
          status:        "confirmed",
          paymentStatus: "completed",
          courier,
          product: {
            id:    product._id,
            title: product.title,
            price: product.price,
          },
          breakdown: {
            productPrice:     product.price,
            discount:         itemDiscount,
            commissionRate:   `${rate}%`,
            commissionAmount: amount,
            totalPaid:        finalItemPrice,
            sellerReceives:   sellerEarnings,
          },
        };
      })
    );

    // ── Remove successfully ordered items from cart ──────────────────────────
    const orderedProductIds = validProducts.map((p) => p._id.toString());
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { cart: { product: { $in: orderedProductIds } } },
    });

    const grandTotal = orderResults.reduce((sum, o) => sum + o.breakdown.totalPaid, 0);

    res.status(201).json({
      success:    true,
      message:    `${orderResults.length} order(s) placed and confirmed successfully! BlueDart Express delivery scheduled.`,
      count:      orderResults.length,
      grandTotal,
      coupon:     couponData,
      orders:     orderResults,
    });
  } catch (error) {
    console.error("checkoutMultiple error:", error);
    res.status(500).json({ message: "Failed to checkout. Please try again" });
  }
};