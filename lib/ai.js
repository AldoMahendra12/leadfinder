import dns from "dns";
import OpenAI from "openai";

dns.setDefaultResultOrder("ipv4first");

function buildOpenRouterError(detail, status = 500, originalError) {
  const error = new Error(`Error: Failed OpenRouter API call - ${detail}`);
  error.status = status;
  if (originalError) {
    error.cause = originalError;
  }
  error.details = detail;
  return error;
}

function extractOpenRouterErrorDetail(error) {
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (error?.response?.data?.error) {
    if (typeof error.response.data.error === "string") {
      return error.response.data.error;
    }
    try {
      return JSON.stringify(error.response.data.error);
    } catch {
      return "Unknown OpenRouter error.";
    }
  }
  if (typeof error?.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return "Unknown OpenRouter error.";
}

/**
 * Extracts location, category, and intent from a natural language prompt.
 * @param {string} prompt - The user's input prompt.
 * @returns {Promise<{location: string, category: string, intent: string}>}
 */
export async function extractDataFromPrompt(prompt) {
  console.log("[AI] extractDataFromPrompt invoked");

  if (!process.env.OPENROUTER_API_KEY) {
    const detail = "Missing OPENROUTER_API_KEY environment variable.";
    console.error("[AI]", detail);
    throw buildOpenRouterError(detail);
  }

  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  try {
    console.log("[AI] Sending prompt to OpenRouter.");
    const stream = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that extracts structured data from a search prompt.
          Extract the following fields:
          - location (e.g., "Nagaon Assam")
          - category (e.g., "cafe")
          - intent (optional, e.g., "website development")
          - requires_missing_website (boolean): Set to true ONLY if the user explicitly wants leads for "website development", "web design", or specifically mentions finding businesses "without websites". For "digital marketing", "SEO", "ads", or general searches, set this to false.

          Return the result as a valid JSON object with keys: "location", "category", "intent", "requires_missing_website".
          If a field is not found, use an empty string (or false for boolean).`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullContent += content;
    }

    // 1. First, try to remove markdown code blocks wrapping the content
    // Use hex code \x60 for backtick to avoid build parser issues with regex literals or strings
    let cleanedContent = fullContent.replace(/\x60{3}json\s*/gi, "").replace(/\x60{3}/g, "").trim();

    // 2. Then try to find the JSON object within the cleaned content
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }

    const data = JSON.parse(cleanedContent);
    console.log("[AI] Successfully parsed OpenRouter response.");

    return {
      location: data.location || "",
      category: data.category || "",
      intent: data.intent || "",
      requires_missing_website: !!data.requires_missing_website
    };
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    const detail = extractOpenRouterErrorDetail(error);
    console.error("[AI] OpenRouter API call failed:", detail, error?.response?.data || error);
    throw buildOpenRouterError(detail, status, error);
  }
}
