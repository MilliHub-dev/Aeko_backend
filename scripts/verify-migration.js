
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('Verifying Migration Counts...');
    
    const counts = {
      users: await prisma.user.count(),
      posts: await prisma.post.count(),
      bookmarks: await prisma.bookmark.count(),
      comments: await prisma.comment.count(),
      communities: await prisma.community.count(),
      transactions: await prisma.transaction.count(),
      chats: await prisma.chat.count(),
      messages: await prisma.message.count(),
      ads: await prisma.ad.count(),
      botConversations: await prisma.botConversation.count(),
      botSettings: await prisma.botSettings.count(),
      challenges: await prisma.challenge.count(),
      debates: await prisma.debate.count(),
      enhancedMessages: await prisma.enhancedMessage.count(),
      interests: await prisma.interest.count(),
      liveStreams: await prisma.liveStream.count(),
      securityEvents: await prisma.securityEvent.count(),
      spaces: await prisma.space.count(),
      statuses: await prisma.status.count(),
    };

    console.table(counts);
    
    // Check specific models requested by user
    const requestedModels = [
      'ads', 'botconversations', 'botsettings', 'challenges', 
      'chats', 'comments', 'communities', 'debates', 'enhancedmessages', 
      'interests', 'livestreams', 'messages', 'posts', 
      'securityevents', 'spaces', 'status', 'transactions', 'users'
    ];

    console.log('\nUser Requested Models Verification:');
    requestedModels.forEach(model => {
        // Map user model name to our count key
        let key = model;
        if (model === 'botconversations') key = 'botConversations';
        if (model === 'botsettings') key = 'botSettings';
        if (model === 'enhancedmessages') key = 'enhancedMessages';
        if (model === 'livestreams') key = 'liveStreams';
        if (model === 'securityevents') key = 'securityEvents';
        if (model === 'status') key = 'statuses'; // Status model table is "status" but prisma model is Status, count key I used is statuses
        
        const exists = counts[key] !== undefined;
        console.log(`- ${model}: ${exists ? 'EXISTS' : 'MISSING'} (Count: ${counts[key]})`);
    });

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
