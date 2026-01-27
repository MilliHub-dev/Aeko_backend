import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getBotResponse = async (userId, message) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { botSettings: true } // Include settings if needed, or rely on user fields
  });
  
  if (!user || !user.botEnabled) return null;

  // botResponses was likely a legacy field. We'll use an empty array or try to fetch from botSettings/preferences if available.
  // For now, defaulting to empty to prevent crash.
  const pastResponses = user.botPreferences?.responses || []; 
  
  const prompt = `Reply like a ${user.botPersonality} person. User’s past replies: ${Array.isArray(pastResponses) ? pastResponses.join(", ") : ""}. Message: ${message}`;

  try {
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
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
};

export default getBotResponse;
