import User from "../models/User.js";

// Get ranked profiles
export const getRankedProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find()
        .select('username name profilePicture goldenTick blueTick')
        .sort({ goldenTick: -1, blueTick: -1, username: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments()
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
