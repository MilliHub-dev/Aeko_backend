import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
await p.user.update({ where: { id: "alice" }, data: { following: [] } });
console.log("  alice now follows nobody");
await p.$disconnect();
