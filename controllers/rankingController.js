import User from "../models/User.js";

// Get ranked profiles
export const getRankedProfiles = async (req, res) => {
  try {
    const users = await User.find().sort({ goldenTick: -1, blueTick: -1, username: 1 }); // Prioritize golden tick
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
