import { Schema, models, model, Types } from "mongoose";

const TripSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    note: { type: String, default: "" },
    truckFare: { type: Number, default: 0, min: 0 },
    loadingCost: { type: Number, default: 0, min: 0 },
    unloadingCost: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

if (models.Trip) delete models.Trip;

export const Trip = model("Trip", TripSchema);
