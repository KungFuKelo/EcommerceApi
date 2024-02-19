const mongoose = require("mongoose");

// Define order schema
const orderSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, unique: true },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true },
      },
    ],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: { type: String, required: true },
    deliveryStatus: {
      type: String,
      enum: ["pending", "packaging", "shipping", "delivered", "canceled"],
      default: "open",
    },
    voucher: { type: String },
    finalPrice: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

// Create Order model
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
