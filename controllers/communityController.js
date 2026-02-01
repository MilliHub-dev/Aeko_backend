import { validationResult } from "express-validator";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// @desc    Create a new community
// @route   POST /api/communities
// @access  Private (Golden tick users only)
export const createCommunity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, isPrivate, tags } = req.body;
    const userId = req.user.id;

    // Check if user has golden tick
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user.goldenTick) {
      return res.status(403).json({ 
        success: false,
        message: 'Only users with golden tick can create communities' 
      });
    }

    // Check if community name already exists
    const existingCommunity = await prisma.community.findFirst({
      where: { name }
    });

    if (existingCommunity) {
      return res.status(409).json({
        success: false,
        message: 'A community with this name already exists'
      });
    }

    // Transaction to create community, chat, and add owner as member
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Create Community
      const community = await prisma.community.create({
        data: {
          name,
          description,
          ownerId: userId,
          isPrivate: isPrivate || false,
          tags: tags || [],
          memberCount: 1, // Owner is the first member
          isActive: true
        }
      });

      // 2. Create Community Chat
      const chat = await prisma.chat.create({
        data: {
          isGroup: true,
          groupName: name,
          isCommunityChat: true,
          communityId: community.id,
          groupAdminId: userId,
          members: {
            create: {
              userId: userId
            }
          }
        }
      });

      // 3. Add owner as Community Member
      await prisma.communityMember.create({
        data: {
          communityId: community.id,
          userId: userId,
          role: 'owner',
          status: 'active'
        }
      });

      return { community, chat };
    });

    res.status(201).json({
      success: true,
      data: result.community
    });
  } catch (error) {
    console.error('Error creating community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public
export const getCommunities = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      isActive: true,
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ]
    };

    const [communities, total] = await Promise.all([
      prisma.community.findMany({
        where,
        include: {
          users: {
            select: {
              name: true,
              username: true,
              profilePicture: true,
              blueTick: true,
              goldenTick: true
            }
          }
        },
        orderBy: [
          { memberCount: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: parseInt(limit)
      }),
      prisma.community.count({ where })
    ]);

    const mappedCommunities = communities.map(community => ({
      ...community,
      owner: community.users,
      users: undefined
    }));

    res.status(200).json({
      success: true,
      data: mappedCommunities,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get community by ID
// @route   GET /api/communities/:id
// @access  Public
export const getCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            name: true,
            username: true,
            profilePicture: true
          }
        },
        members: {
          take: 5, // Limit displayed members for preview
          include: {
            user: {
              select: {
                name: true,
                username: true,
                profilePicture: true
              }
            }
          }
        }
      }
    });

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is member (for private communities)
    let isMember = false;
    if (userId) {
      const memberRecord = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: id,
            userId: userId
          }
        }
      });
      isMember = !!memberRecord;
    }

    if (community.isPrivate && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'This is a private community. You need to be a member to view it.'
      });
    }

    // Fetch moderators separately
    const moderators = await prisma.communityMember.findMany({
      where: {
        communityId: id,
        role: 'moderator'
      },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            profilePicture: true,
            blueTick: true,
            goldenTick: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...community,
        owner: community.users,
        users: undefined,
        moderators: moderators.map(m => m.user)
      }
    });
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Join a community
// @route   POST /api/communities/:id/join
// @access  Private
export const joinCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        chat: true
      }
    });

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if already a member
    const existingMember = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: id,
          userId: userId
        }
      }
    });

    if (existingMember) {
      if (existingMember.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of this community'
        });
      }
      if (existingMember.status === 'banned') {
        return res.status(403).json({
          success: false,
          message: 'You are banned from this community'
        });
      }
      // If pending, just return status
      if (existingMember.status === 'pending') {
         return res.status(200).json({
          success: true,
          message: 'Join request already sent. Waiting for approval.',
          requiresApproval: true
        });
      }
    }

    // Check if community is paid - require payment before joining
    // Access settings using type assertion or check if it exists
    const settings = community.settings;
    if (settings && typeof settings === 'object' && 'payment' in settings && settings.payment?.isPaidCommunity) {
      return res.status(402).json({
        success: false,
        message: 'This is a paid community. Please complete payment first.',
        requiresPayment: true,
        paymentInfo: {
          price: settings.payment.price,
          currency: settings.payment.currency,
          subscriptionType: settings.payment.subscriptionType,
          availableMethods: settings.payment.paymentMethods
        }
      });
    }

    // For private communities, add to pending requests
    // Note: settings might be null, so check safely
    const isPrivate = community.isPrivate || (settings && settings.isPrivate);
    
    if (isPrivate) {
      // Create pending member
      await prisma.communityMember.create({
        data: {
          communityId: id,
          userId: userId,
          role: 'member',
          status: 'pending'
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Join request sent. Waiting for approval.',
        requiresApproval: true
      });
    }

    // For free public communities, add directly
    const requireApproval = settings && settings.requireApproval;
    const status = requireApproval ? 'pending' : 'active';
    
    await prisma.$transaction(async (prisma) => {
      // Add member
      await prisma.communityMember.create({
        data: {
          communityId: id,
          userId: userId,
          role: 'member',
          status: status
        }
      });

      // Increment member count if active
      if (status === 'active') {
        await prisma.community.update({
          where: { id },
          data: {
            memberCount: { increment: 1 }
          }
        });

        // Add to chat if active
        if (community.chat) {
          // Check if already in chat to avoid unique constraint error
          const inChat = await prisma.chatMember.findUnique({
            where: {
              chatId_userId: {
                chatId: community.chat.id,
                userId: userId
              }
            }
          });
          
          if (!inChat) {
            await prisma.chatMember.create({
              data: {
                chatId: community.chat.id,
                userId: userId
              }
            });
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: status === 'pending' ? 
        'Join request sent. Waiting for approval.' : 
        'Successfully joined the community',
      data: { status }
    });
  } catch (error) {
    console.error('Error joining community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Leave a community
// @route   POST /api/communities/:id/leave
// @access  Private
export const leaveCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        chat: true
      }
    });

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if owner
    if (community.ownerId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Community owner cannot leave. Transfer ownership or delete the community.'
      });
    }

    // Check if member
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: id,
          userId: userId
        }
      }
    });

    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this community'
      });
    }

    await prisma.$transaction(async (prisma) => {
      // Remove member
      await prisma.communityMember.delete({
        where: {
          communityId_userId: {
            communityId: id,
            userId: userId
          }
        }
      });

      // Decrement member count if was active
      if (member.status === 'active') {
        await prisma.community.update({
          where: { id },
          data: {
            memberCount: { decrement: 1 }
          }
        });

        // Remove from chat
        if (community.chat) {
           // Check if in chat first
           const inChat = await prisma.chatMember.findUnique({
             where: {
               chatId_userId: {
                 chatId: community.chat.id,
                 userId: userId
               }
             }
           });
           
           if (inChat) {
             await prisma.chatMember.delete({
               where: {
                 chatId_userId: {
                   chatId: community.chat.id,
                   userId: userId
                 }
               }
             });
           }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully left the community'
    });
  } catch (error) {
    console.error('Error leaving community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update community
// @route   PUT /api/communities/:id
// @access  Private (Community owner/moderators)
export const updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPrivate, tags, settings } = req.body;
    const userId = req.user.id;

    const community = await prisma.community.findUnique({
      where: { id }
    });

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check permissions
    const member = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: id,
          userId: userId
        }
      }
    });

    const isOwner = community.ownerId === userId;
    const isModerator = member?.role === 'moderator';

    if (!isOwner && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community'
      });
    }

    // Update data
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (typeof isPrivate !== 'undefined') updateData.isPrivate = isPrivate;
    if (tags) updateData.tags = tags;
    
    if (settings) {
      // Merge settings if exists
      const currentSettings = community.settings || {};
      updateData.settings = { ...currentSettings, ...settings };
    }

    const updatedCommunity = await prisma.community.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({
      success: true,
      data: updatedCommunity
    });
  } catch (error) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete community
// @route   DELETE /api/communities/:id
// @access  Private (Community owner only)
export const deleteCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const community = await prisma.community.findUnique({
      where: { id },
      include: {
        chat: true
      }
    });

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if owner
    if (community.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this community'
      });
    }

    // Soft delete (mark inactive)
    // Or we could perform actual deletion if desired, but code said "Soft delete"
    // The previous code also removed members. 
    // Let's mark inactive and remove members to clear up relations but keep history if needed?
    // Actually, the previous code did: community.isActive = false; await community.save(); then removed members.
    
    await prisma.$transaction(async (prisma) => {
      // 1. Mark inactive
      await prisma.community.update({
        where: { id },
        data: { isActive: false }
      });

      // 2. Remove all members (actually delete them from the join table)
      await prisma.communityMember.deleteMany({
        where: { communityId: id }
      });

      // 3. Handle chat (optional, maybe mark inactive too?)
      // For now, let's leave chat but remove members from it?
      if (community.chat) {
        // Find all chat members that are in this community chat
        // Actually, since we removed community members, we should probably clear chat members too
        await prisma.chatMember.deleteMany({
          where: { chatId: community.chat.id }
        });
      }
    });

    res.status(200).json({
      success: true,
      message: 'Community deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting community:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
