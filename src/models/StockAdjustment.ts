import { Schema, models, model, Types } from "mongoose";

const StockAdjustmentSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    type: { type: String, enum: ["loss", "surplus"], required: true },
    qty: { type: Number, required: true, min: 0.01 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

StockAdjustmentSchema.index({ productId: 1, createdAt: -1 });

if (models.StockAdjustment) delete models.StockAdjustment;

export const StockAdjustment = model("StockAdjustment", StockAdjustmentSchema);
