import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.$on('error', (event) => {
    console.error('Prisma error event:', event);
});

prisma.$on('warn', (event) => {
    console.warn('Prisma warning event:', event);
});

const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("PostgreSQL Connected via Prisma...");
    } catch (error) {
        console.error("Database connection failed:", {
            name: error?.name,
            code: error?.code,
            message: error?.message,
            stack: error?.stack
        });
        // process.exit(1); // Optional: decide if you want to crash on db fail
    }
};

export { prisma };
export default connectDB;
