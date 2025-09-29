
import { GoogleGenAI } from "@google/genai";
import { Person, PersonCategory } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateBio = async (
  firstName: string,
  lastName: string,
  category: PersonCategory,
  roleOrClass: string
): Promise<string> => {
  const roleDescription = category === PersonCategory.STUDENT ? `a student in ${roleOrClass}` : `a ${roleOrClass}`;
  
  const prompt = `Generate a short, positive, one-sentence professional description for ${firstName} ${lastName}, who is ${roleDescription}. Keep it under 20 words. Example: 'A dedicated educator shaping future minds.' or 'An enthusiastic learner with a bright future.'`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating bio with Gemini:", error);
    // Return a fallback bio on error
    return "A valued member of our community.";
  }
};
