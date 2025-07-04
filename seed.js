import mongoose from "mongoose";
import connectDB from "./config/db";
import User from "./models/User";

connectDB();

const seedUsers = async () => {
  await User.create({ name: "Test User", username: "testuser", email: "test@example.com", password: "123456" });
  console.log("✅ Users Seeded");
  process.exit();
};

seedUsers();
