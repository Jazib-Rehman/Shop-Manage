import { Schema, models, model, Types } from "mongoose";

const PartnerSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    incomePercent: { type: Number, default: 100, min: 0, max: 100 },
  },
  { timestamps: true }
);

if (models.Partner) delete models.Partner;

export const Partner = model("Partner", PartnerSchema);
