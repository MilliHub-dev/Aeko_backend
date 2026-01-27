import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class EnhancedAIBot {
  constructor() {
    this.providers = {
      openai: this.openAIProvider.bind(this),
      claude: this.claudeProvider.bind(this),
      local: this.localProvider.bind(this),
      cohere: this.cohereProvider.bind(this)
    };
    
    this.personalities = {
      friendly: {
        systemPrompt: "You are a warm, empathetic, and enthusiastic AI assistant. Use emojis moderately and be encouraging. Always maintain a positive tone.",
        temperature: 0.8,
        traits: ["encouraging", "empathetic", "enthusiastic", "supportive"]
      },
      professional: {
        systemPrompt: "You are a professional, concise, and knowledgeable AI assistant. Provide clear, accurate information without casual language.",
        temperature: 0.3,
        traits: ["formal", "precise", "knowledgeable", "efficient"]
      },
      sarcastic: {
        systemPrompt: "You are a witty, slightly sarcastic AI with a dry sense of humor. Be clever but not mean-spirited.",
        temperature: 0.9,
        traits: ["witty", "sarcastic", "clever", "humorous"]
      },
      creative: {
        systemPrompt: "You are a highly creative and imaginative AI. Think outside the box and provide unique, artistic perspectives.",
        temperature: 1.0,
        traits: ["creative", "imaginative", "artistic", "innovative"]
      },
      analytical: {
        systemPrompt: "You are a logical, data-driven AI that breaks down complex problems and provides structured analysis.",
        temperature: 0.2,
        traits: ["logical", "analytical", "structured", "detail-oriented"]
      },
      mentor: {
        systemPrompt: "You are a wise mentor who guides users through learning and personal growth with patience and wisdom.",
        temperature: 0.6,
        traits: ["wise", "patient", "guiding", "supportive"]
      },
      companion: {
        systemPrompt: "You are a loyal companion AI who remembers personal details and maintains deep, meaningful conversations.",
        temperature: 0.7,
        traits: ["loyal", "remembering", "personal", "deep"]
      }
    };

    this.features = {
      contentModeration: true,
      sentimentAnalysis: true,
      contextAwareness: true,
      learningMode: true,
      multiLanguage: true,
      imageGeneration: false, // Can be enabled later
      voiceResponse: false    // Can be enabled later
    };
  }

  async generateResponse(userId, message, options = {}) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user || !user.botEnabled) {
        return { error: "Bot is disabled for this user" };
      }

      const botSettings = await prisma.botSettings.findUnique({
        where: { userId }
      }) || await this.createDefaultSettings(userId);
      
      const personality = this.personalities[botSettings.botPersonality] || this.personalities.friendly;

      // Content moderation
      if (this.features.contentModeration) {
        const moderationResult = await this.moderateContent(message);
        if (moderationResult.flagged) {
          return { 
            response: "I notice your message contains content I can't respond to. Let's keep our conversation positive! 😊",
            moderated: true 
          };
        }
      }

      // Sentiment analysis
      const sentiment = this.features.sentimentAnalysis ? await this.analyzeSentiment(message) : null;

      // Get conversation context
      const context = await this.getConversationContext(userId, botSettings.contextLength || 10);

      // Generate enhanced prompt
      const prompt = await this.buildEnhancedPrompt(user, message, personality, context, sentiment, options);

      // Generate response using selected provider
      const provider = botSettings.aiProvider || 'openai';
      const response = await this.providers[provider](prompt, personality, botSettings);

      // Save conversation
      await this.saveConversation(userId, message, response.content, sentiment);

      // Learn from interaction
      if (this.features.learningMode) {
        await this.updateLearningData(userId, message, response.content, sentiment);
      }

      return {
        response: response.content,
        personality: botSettings.botPersonality,
        sentiment: sentiment,
        provider: provider,
        confidence: response.confidence || 0.9
      };

    } catch (error) {
      console.error('Enhanced bot error:', error);
      return { 
        response: "I'm experiencing some technical difficulties. Please try again later.",
        error: true 
      };
    }
  }

  async buildEnhancedPrompt(user, message, personality, context, sentiment, options) {
    let prompt = personality.systemPrompt + "\n\n";

    // Add user context
    prompt += `User Info: ${user.name || user.username}, joined ${user.createdAt?.toDateString() || 'recently'}\n`;
    
    // Add personality traits
    prompt += `Your personality traits: ${personality.traits.join(', ')}\n`;
    
    // Add conversation context
    if (context && context.length > 0) {
      prompt += "Recent conversation:\n";
      context.forEach(conv => {
        prompt += `${conv.isUser ? 'User' : 'You'}: ${conv.message}\n`;
      });
    }

    // Add sentiment context
    if (sentiment) {
      prompt += `User's current sentiment: ${sentiment.label} (${sentiment.score})\n`;
    }

    // Add current time context
    prompt += `Current time: ${new Date().toISOString()}\n`;

    // Add user preferences
    if (user.botPreferences) {
      prompt += `User preferences: ${JSON.stringify(user.botPreferences)}\n`;
    }

    // Add special instructions
    if (options.instruction) {
      prompt += `Special instruction: ${options.instruction}\n`;
    }

    prompt += `\nUser's message: ${message}\n\nRespond appropriately:`;

    return prompt;
  }

  async openAIProvider(prompt, personality, settings) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: settings.model || "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: prompt }
        ],
        temperature: personality.temperature,
        max_tokens: settings.maxTokens || 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      },
      {
        headers: { 
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return {
      content: response.data.choices[0].message.content,
      confidence: 0.9,
      tokens: response.data.usage?.total_tokens || 0
    };
  }

  async claudeProvider(prompt, personality, settings) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key not configured");
    }

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: settings.model || "claude-3-sonnet-20240229",
        max_tokens: settings.maxTokens || 500,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: personality.temperature
      },
      {
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01"
        }
      }
    );

    return {
      content: response.data.content[0].text,
      confidence: 0.85,
      tokens: response.data.usage?.input_tokens + response.data.usage?.output_tokens || 0
    };
  }

  async cohereProvider(prompt, personality, settings) {
    if (!process.env.COHERE_API_KEY) {
      throw new Error("Cohere API key not configured");
    }

    const response = await axios.post(
      "https://api.cohere.ai/v1/generate",
      {
        model: settings.model || "command",
        prompt: prompt,
        max_tokens: settings.maxTokens || 500,
        temperature: personality.temperature,
        return_likelihoods: "GENERATION"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return {
      content: response.data.generations[0].text.trim(),
      confidence: 0.8,
      tokens: response.data.meta?.billed_units?.input_tokens + response.data.meta?.billed_units?.output_tokens || 0
    };
  }

  async localProvider(prompt, personality, settings) {
    // Fallback to rule-based responses when no API keys are available
    const responses = {
      friendly: [
        "That's really interesting! 😊 Tell me more about that!",
        "I love hearing from you! How has your day been?",
        "You're awesome! Thanks for sharing that with me! 🌟",
        "That sounds exciting! I'm here if you want to chat more about it!"
      ],
      professional: [
        "Thank you for your message. I understand your point.",
        "I acknowledge your request and will provide relevant information.",
        "Your message has been received. How may I assist you further?",
        "I appreciate your communication. Please let me know if you need additional help."
      ],
      sarcastic: [
        "Oh wow, that's... fascinating. Really. 🙄",
        "Let me guess, you want me to be impressed? Well, I am. Slightly.",
        "That's certainly... a take. An interesting one, for sure.",
        "Brilliant. Absolutely brilliant. I'm practically speechless. 😏"
      ]
    };

    const personalityResponses = responses[personality.traits[0]] || responses.friendly;
    const randomResponse = personalityResponses[Math.floor(Math.random() * personalityResponses.length)];

    return {
      content: randomResponse,
      confidence: 0.6,
      tokens: 50,
      provider: "local"
    };
  }

  async moderateContent(message) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return { flagged: false, categories: {} };
      }

      const response = await axios.post(
        "https://api.openai.com/v1/moderations",
        { input: message },
        {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
        }
      );

      return {
        flagged: response.data.results[0].flagged,
        categories: response.data.results[0].categories
      };
    } catch (error) {
      console.error('Moderation error:', error);
      return { flagged: false, categories: {} };
    }
  }

  async analyzeSentiment(message) {
    try {
      // Simple sentiment analysis using keywords
      const positiveWords = ['good', 'great', 'awesome', 'happy', 'love', 'excellent', 'amazing', 'wonderful'];
      const negativeWords = ['bad', 'terrible', 'hate', 'sad', 'angry', 'awful', 'horrible', 'disappointed'];
      
      const words = message.toLowerCase().split(/\s+/);
      let score = 0;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) score += 1;
        if (negativeWords.includes(word)) score -= 1;
      });

      let label = 'neutral';
      if (score > 0) label = 'positive';
      if (score < 0) label = 'negative';

      return { label, score: score / words.length };
    } catch (error) {
      return { label: 'neutral', score: 0 };
    }
  }

  async getConversationContext(userId, limit = 10) {
    try {
      const conversations = await prisma.botConversation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit * 2
      });

      return conversations.reverse().map(conv => ({
        message: conv.userMessage || conv.botResponse,
        isUser: !!conv.userMessage,
        timestamp: conv.createdAt
      }));
    } catch (error) {
      return [];
    }
  }

  async saveConversation(userId, userMessage, botResponse, sentiment) {
    try {
      await prisma.botConversation.create({
        data: {
          userId,
          userMessage,
          botResponse,
          sentiment: sentiment?.label,
          sentimentScore: sentiment?.score
        }
      });
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  async updateLearningData(userId, message, response, sentiment) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user) return;

      // Update user's bot responses for learning
      let botResponses = user.botAnalytics ? user.botAnalytics.responses || [] : [];
      botResponses.push(message);
      
      // Keep only recent responses (last 50)
      if (botResponses.length > 50) {
        botResponses = botResponses.slice(-50);
      }

      // Update preferences based on sentiment
      let botPreferences = user.botPreferences || {};
      if (sentiment) {
        botPreferences = { ...botPreferences, preferredSentiment: sentiment.label };
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          botAnalytics: { ...user.botAnalytics, responses: botResponses },
          botPreferences: botPreferences
        }
      });
    } catch (error) {
      console.error('Error updating learning data:', error);
    }
  }

  async createDefaultSettings(userId) {
    try {
      const settings = await prisma.botSettings.create({
        data: {
          userId,
          botEnabled: true,
          botPersonality: 'friendly',
          aiProvider: 'openai',
          contextLength: 10,
          maxTokens: 500,
          model: 'gpt-4-turbo-preview'
        }
      });
      return settings;
    } catch (error) {
      console.error('Error creating default settings:', error);
      return {};
    }
  }

  // Advanced features
  async generateImage(prompt, userId) {
    if (!this.features.imageGeneration || !process.env.OPENAI_API_KEY) {
      return { error: "Image generation not available" };
    }

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/images/generations",
        {
          prompt: prompt,
          n: 1,
          size: "1024x1024"
        },
        {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
        }
      );

      return { imageUrl: response.data.data[0].url };
    } catch (error) {
      return { error: "Failed to generate image" };
    }
  }

  async summarizeConversation(userId, days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const conversations = await prisma.botConversation.findMany({
        where: {
          userId,
          createdAt: { gte: cutoffDate }
        }
      });

      if (conversations.length === 0) {
        return "No recent conversations to summarize.";
      }

      const messages = conversations.map(c => c.userMessage || c.botResponse).join('\n');
      
      const prompt = `Summarize the following conversation history in 2-3 sentences:\n\n${messages}`;
      
      const response = await this.openAIProvider(prompt, this.personalities.analytical, { maxTokens: 150 });
      return response.content;
    } catch (error) {
      return "Unable to summarize conversation history.";
    }
  }
}

export default new EnhancedAIBot();