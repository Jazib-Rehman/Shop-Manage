import { Schema, models, model, Types } from "mongoose";

const PartnerLedgerSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    partnerId: { type: Types.ObjectId, ref: "Partner", required: true },
    type: {
      type: String,
      enum: ["sale_share", "payout", "adjustment", "investment", "purchase_share"],
      required: true,
    },
    amount: { type: Number, required: true },
    qty: { type: Number, default: 0 },
    saleId: { type: Types.ObjectId, ref: "Sale", default: null },
    purchaseId: { type: Types.ObjectId, ref: "Purchase", default: null },
    productId: { type: Types.ObjectId, ref: "Product", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

PartnerLedgerSchema.index({ partnerId: 1, createdAt: -1 });
PartnerLedgerSchema.index({ saleId: 1 });
PartnerLedgerSchema.index({ purchaseId: 1 });

if (models.PartnerLedger) delete models.PartnerLedger;

export const PartnerLedger = model("PartnerLedger", PartnerLedgerSchema);
