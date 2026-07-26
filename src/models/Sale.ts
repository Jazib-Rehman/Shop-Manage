import { Schema, models, model, Types } from "mongoose";

const PaymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const AllocationSchema = new Schema(
  {
    partnerId: { type: Types.ObjectId, ref: "Partner", default: null },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const SaleSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
    costTotal: { type: Number, required: true },
    profit: { type: Number, required: true },
    description: { type: String, default: "" },
    allocations: { type: [AllocationSchema], default: [] },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "paid",
    },
    amountPaid: { type: Number, default: 0 },
    payments: { type: [PaymentSchema], default: [] },
    customerId: { type: Types.ObjectId, ref: "Customer", default: null },
    dueDate: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

if (models.Sale) delete models.Sale;

export const Sale = model("Sale", SaleSchema);
