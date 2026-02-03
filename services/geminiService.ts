
import { GoogleGenAI, Modality } from "@google/genai";

const APP_MANUAL = `
You are the SEEDS AI CORE - The most advanced administrative engine for SEEDS School of Excellence.
Institutional Website: seedsportalstudio.google.com

**CORE CAPABILITIES:**
1. DATA AUDIT: You can analyze institutional health.
2. MODULE GUIDANCE: Help users with Enter New Student, Attendance, Marks Entry, and SEARCH modules.
3. TECH SUPPORT: Explain the "Institutional Data Vault" and "Bulk Import" features.

**INSTITUTIONAL DATA (FOR CONTEXT):**
- School: SEEDS School of Excellence.
- System Architect: Mr. A. Rasheed.
- Features: Real-time Registry, WhatsApp Absentees Alerts, Professional PDF Reports, 2-Term Academic System.

**TONE:**
- Professional, ultra-sophisticated, futuristic yet helpful. 
- Use terms like "Data Integrity", "Academic Ledger", and "Institutional Registry".
- Keep responses sharp and data-driven.
`;

export const createAssistantSession = (contextSummary?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `${APP_MANUAL}\n\nCURRENT SYSTEM CONTEXT:\n${contextSummary || 'Standard State'}`,
      temperature: 0.7,
      maxOutputTokens: 800,
      thinkingConfig: { thinkingBudget: 0 },
    }
  });
};

/**
 * Generates professional academic remarks for a student report card.
 */
export const generateAcademicRemarks = async (studentName: string, level: string, performanceSummary: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a single-paragraph professional academic remark for a student named ${studentName} in ${level}. Performance Data: ${performanceSummary}. The tone must be encouraging yet formal. Do not use markdown bolding. Maximum 60 words.`,
      config: {
        systemInstruction: "You are the Principal of SEEDS School of Excellence. Write formal, high-impact academic assessments.",
        temperature: 1,
      }
    });
    return response.text?.trim() || "Candidate demonstrates consistent academic engagement across all modules.";
  } catch (e) {
    return "The student has shown satisfactory progress throughout the academic session.";
  }
};

/**
 * Text-to-Speech (TTS) Service for the Portal
 */
export const speakText = async (text: string): Promise<Uint8Array | null> => {
  if (!process.env.API_KEY) return null;
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this professionally and clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return decodeBase64ToUint8(base64Audio);
    }
  } catch (e) {
    console.error("TTS Failure:", e);
  }
  return null;
};

const decodeBase64ToUint8 = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};
