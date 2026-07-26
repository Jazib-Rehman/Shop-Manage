import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConn: Promise<typeof mongoose> | undefined;
}

export function db() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");

  if (!global.mongooseConn) {
    global.mongooseConn = mongoose
      .connect(uri, { dbName: "shop-manager" })
      .catch((err) => {
        global.mongooseConn = undefined;
        throw err;
      });
  }
  return global.mongooseConn;
}
