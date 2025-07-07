import jwt from "jsonwebtoken";
import bcrypt from 'bcrypt';

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: "Forbidden: Invalid token" });
      }

      req.userId = decoded.userId;
      next();
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export default authMiddleware;
