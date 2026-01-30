
import { prisma } from "./config/db.js";

async function auditMediaPosts() {
    try {
        console.log("Auditing posts with type 'image' or 'video'...");
        
        const posts = await prisma.post.findMany({
            where: {
                type: { in: ['image', 'video'] }
            },
            select: {
                id: true,
                text: true,
                type: true,
                media: true,
                createdAt: true,
                users_posts_userIdTouser: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        let badPosts = 0;
        posts.forEach(post => {
            let isValid = false;
            const m = post.media;

            if (typeof m === 'string' && m.length > 0) isValid = true;
            else if (Array.isArray(m) && m.length > 0) isValid = true;
            else if (typeof m === 'object' && m !== null && (m.url || Object.keys(m).length > 0)) isValid = true;

            if (!isValid) {
                badPosts++;
                console.log(`\n[BAD POST] ID: ${post.id}`);
                console.log(`User: ${post.users_posts_userIdTouser?.username}`);
                console.log(`Text: "${post.text}"`);
                console.log(`Type: ${post.type}`);
                console.log(`Media:`, JSON.stringify(m));
                console.log(`Created: ${post.createdAt}`);
            }
        });

        console.log(`\nFound ${badPosts} posts with missing/empty media out of ${posts.length} total image/video posts.`);

    } catch (error) {
        console.error("Audit failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

auditMediaPosts();
