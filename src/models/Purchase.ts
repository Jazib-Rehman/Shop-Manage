import { Schema, models, model, Types } from "mongoose";

const PurchaseSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    total: { type: Number, required: true },
    description: { type: String, default: "" },
    tripId: { type: Types.ObjectId, ref: "Trip", default: null },
  },
  { timestamps: true }
);

if (models.Purchase) delete models.Purchase;

export const Purchase = model("Purchase", PurchaseSchema);
