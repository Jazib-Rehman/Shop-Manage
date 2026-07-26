/**
 * Assign orphan (no userId) shop docs to one account.
 *   npm run migrate-shop-user
 */
import mongoose from "mongoose";

const USER_ID = process.env.MIGRATE_USER_ID || "6a6583e631579b838ab48ec8";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  console.log("Connecting…");
  await mongoose.connect(uri, { dbName: "shop-manager", serverSelectionTimeoutMS: 20000 });
  const filter = { $or: [{ userId: { $exists: false } }, { userId: null }] };
  const userId = new mongoose.Types.ObjectId(USER_ID);
  const cols = await mongoose.connection.db!.listCollections().toArray();

  for (const { name } of cols) {
    if (name === "users" || name.startsWith("system.")) continue;
    const res = await mongoose.connection.collection(name).updateMany(filter, { $set: { userId } });
    console.log(`${name}: ${res.modifiedCount} updated (${res.matchedCount} matched)`);
  }
  console.log(`Done → user ${USER_ID}`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
