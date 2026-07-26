import { Schema, models, model, Types } from "mongoose";

const CustomerSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ userId: 1, phone: 1 }, { unique: true });

if (models.Customer) delete models.Customer;

export const Customer = model("Customer", CustomerSchema);
