import { Schema, models, model, Types } from "mongoose";

const ExpenseSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    spentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ userId: 1, spentAt: -1 });

if (models.Expense) delete models.Expense;

export const Expense = model("Expense", ExpenseSchema);
