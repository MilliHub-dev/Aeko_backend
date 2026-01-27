import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("PostgreSQL Connected via Prisma...");
    } catch (error) {
        console.error("Database connection failed:", error.message);
        // process.exit(1); // Optional: decide if you want to crash on db fail
    }
};

export { prisma };
export default connectDB;
