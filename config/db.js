// db.js (or database.js)
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.warn("MONGO_URI not configured. Running without database connection.");
            return;
        }
        
        await mongoose.connect(process.env.MONGO_URI, {
           // useNewUrlParser: true,
           // useUnifiedTopology: true,
        });
        console.log("MongoDB Connected...");
    } catch (error) {
        console.error("Database connection failed:", error.message);
        console.warn("Continuing without database connection...");
        // Don't exit the process, just log the error and continue
    }
};

export default connectDB; // ✅ ES Module export
