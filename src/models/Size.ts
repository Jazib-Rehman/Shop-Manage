import { Schema, models, model, Types } from "mongoose";

const SizeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, trim: true },
    unit: { type: String, enum: ["sqft", "piece"], required: true, default: "sqft" },
    sqFtPerTon: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

SizeSchema.index({ userId: 1, label: 1 }, { unique: true });

if (models.Size) delete models.Size;

export const Size = model("Size", SizeSchema);
