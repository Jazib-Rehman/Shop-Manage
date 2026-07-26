import { Schema, models, model, Types } from "mongoose";

const ShareSchema = new Schema(
  {
    partnerId: { type: Types.ObjectId, ref: "Partner", required: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    marbleId: { type: Types.ObjectId, ref: "Marble", required: true },
    name: { type: String, required: true },
    dimension: { type: String, required: true },
    tonsPerSqFt: { type: Number, default: 0, min: 0 },
    sqFtPerTon: { type: Number, default: 0, min: 0 },
    sku: { type: String, required: true },
    stock: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    costActual: { type: Number, default: 0 },
    costFreight: { type: Number, default: 0 },
    costLoss: { type: Number, default: 0 },
    sellPrice: { type: Number, default: 0 },
    soldQty: { type: Number, default: 0 },
    lowStockAt: { type: Number, default: 5 },
    shares: { type: [ShareSchema], default: [] },
  },
  { timestamps: true }
);

ProductSchema.index({ userId: 1, marbleId: 1, dimension: 1 }, { unique: true });
ProductSchema.index({ userId: 1, sku: 1 }, { unique: true });

if (models.Product) delete models.Product;

export const Product = model("Product", ProductSchema);
