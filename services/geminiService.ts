import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = "gemini-2.5-flash-lite";

// Fallback content for offline mode
const OFFLINE_TAUNTS = [
  "Calculations complete. Your defeat is statistically probable.",
  "Optical arrays aligning. Target acquired.",
  "Human error detected in previous move.",
  "My logic gates predict your surrender.",
  "Laser intensity at 100%. Prepare for vaporization.",
  "Your strategy is quaint, biological entity.",
  "Refraction angles optimized. Firing solution set."
];

const OFFLINE_TIPS = [
  "TIR (Total Internal Reflection): Hit the FLAT side of a prism to reflect 90°.",
  "REFRACTION: Hit the SLANTED side (Hypotenuse) to pass through diagonally.",
  "DEFENSE: Use Blocks to absorb laser fire. They crack after 1 hit!",
  "ATTACK: A diagonal shot (Refraction) is great for bypassing enemy shields.",
  "MOVEMENT: Rolling a 2 allows you to move ONE piece 2 steps, or TWO pieces 1 step.",
  "STRATEGY: Protect your King! One direct hit causes a catastrophic explosion."
];

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (process.env.API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  }

  async getTaunt(actionDescription: string): Promise<string> {
    if (!this.ai) {
      return this.getRandomOffline(OFFLINE_TAUNTS);
    }

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: `You are a menacing AI named 'AI CORE' playing a laser chess game against a human. You just performed this action: "${actionDescription}". Give a short, robotic, 1-sentence taunt.`,
        config: {
          systemInstruction: "You are a cold, calculating military AI. Keep responses under 20 words.",
          thinkingConfig: { thinkingBudget: 0 } 
        }
      });
      return response.text || this.getRandomOffline(OFFLINE_TAUNTS);
    } catch (error) {
      console.warn("Gemini API Error (Taunt):", error);
      return this.getRandomOffline(OFFLINE_TAUNTS);
    }
  }

  async getTacticalAdvice(): Promise<string> {
    if (!this.ai) {
      return this.getRandomOffline(OFFLINE_TIPS);
    }

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: "Explain Total Internal Reflection (hitting flat side of prism: reflects 90deg) vs Refraction (hitting slanted side: bends diagonal) in 1 sentence for a game player.",
        config: {
          systemInstruction: "You are a physics tactician advising a player in a laser game. Be concise.",
        }
      });
      return response.text || this.getRandomOffline(OFFLINE_TIPS);
    } catch (error) {
      console.warn("Gemini API Error (Advice):", error);
      return this.getRandomOffline(OFFLINE_TIPS);
    }
  }

  private getRandomOffline(list: string[]): string {
    return list[Math.floor(Math.random() * list.length)];
  }
}

export const geminiService = new GeminiService();