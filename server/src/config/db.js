import mongoose from "mongoose";
import { env } from "./env.js";

// Connect to MongoDB Atlas.
export const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("------------------------------------");
    console.log("       MongoDB Connected");
    console.log("------------------------------------");
    console.log(`Database: ${mongoose.connection.name}`);
    console.log("------------------------------------");

  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

// Disconnect from MongoDB.
export const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log("MongoDB connection closed.");
};