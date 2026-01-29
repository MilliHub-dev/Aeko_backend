import { prisma } from "../config/db.js";

// Get ranked profiles
export const getRankedProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          username: true,
          name: true,
          profilePicture: true,
          goldenTick: true,
          blueTick: true
        },
        orderBy: [
          { goldenTick: 'desc' },
          { blueTick: 'desc' },
          { username: 'asc' }
        ],
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count()
    ]);
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching ranked profiles:', error);
    
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
