import axios from "axios";
import User from "../models/User.js";

const getBotResponse = async (userId, message) => {
  const user = await User.findById(userId);
  if (!user || !user.botEnabled) return null;

  const prompt = `Reply like a ${user.botPersonality} person. User’s past replies: ${user.botResponses.join(", ")}. Message: ${message}`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    }
  );

  return response.data.choices[0].message.content;
};

export default getBotResponse;
