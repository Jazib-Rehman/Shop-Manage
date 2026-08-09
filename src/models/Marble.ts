import { Schema, models, model, Types } from "mongoose";

const MarbleSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sizeIds: [{ type: Types.ObjectId, ref: "Size" }],
    dimensions: [{ type: String, trim: true }],
    dimensionWeights: {
      type: [
        {
          dimension: { type: String, required: true, trim: true },
          sqFtPerTon: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

MarbleSchema.index({ userId: 1, name: 1 }, { unique: true });

if (models.Marble) delete models.Marble;

export const Marble = model("Marble", MarbleSchema);
