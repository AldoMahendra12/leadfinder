import OpenAI from "openai";

/**
 * Generates a personalized email draft (Subject and Body) for a lead at a specific sequence step.
 * @param {Object} lead - The lead object.
 * @param {number} step - The sequence step (1, 2, or 3).
 * @returns {Promise<{subject: string, body: string}>}
 */
export async function generateEmailDraft(lead, step = 1) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("[EmailComposer] Missing OPENROUTER_API_KEY, using fallback template.");
    return getFallbackTemplate(lead, step);
  }

  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const firstName = lead.ownerName && lead.ownerName !== "N/A" ? lead.ownerName : "there";
  const businessName = lead.name || "your business";
  const category = lead.category && lead.category !== "Unknown" ? lead.category : "business";
  const city = lead.location && lead.location !== "Unknown" ? lead.location : "your area";
  const rating = lead.rating && lead.rating !== "N/A" ? lead.rating : "";
  const reviewCount = lead.reviewCount && lead.reviewCount !== "N/A" ? lead.reviewCount : "";

  let prompt = "";
  if (step === 1) {
    prompt = `Write a short, friendly, and highly personalized cold email (Step 1) to a business owner.
Our service is "AI Google Reviews Automation" (we automate review generation/requesting for their business).

Lead Details:
- First Name: ${firstName}
- Business Name: ${businessName}
- Category: ${category}
- City: ${city}
- Google Rating: ${rating ? rating + " stars" : "N/A"}
- Review Count: ${reviewCount ? reviewCount + " reviews" : "N/A"}

Goal: Introduce the idea of review automation in a helpful, non-salesy way. Refer to their current review count and rating to personalize the hook. Keep it very conversational, direct, and under 100 words. Do not use corporate jargon or hype words.

Response format:
Provide the output as a valid JSON object with "subject" and "body" keys. Do NOT wrap the JSON in markdown code blocks.
Example format:
{
  "subject": "Quick question, ${firstName}",
  "body": "Hi ${firstName},\\n\\nI was checking out ${businessName}...\\n\\nRegards,\\n[YourName]"
}`;
  } else if (step === 2) {
    prompt = `Write a short follow-up cold email (Step 2) to a business owner.
Our service is "AI Google Reviews Automation".

Lead Details:
- First Name: ${firstName}
- Business Name: ${businessName}
- Category: ${category}
- City: ${city}

Goal: Gently follow up on the previous email (assume it got buried, don't be pushy). Mention how this helps ${category} businesses in ${city} get more reviews on autopilot. Under 80 words.

Response format:
Provide the output as a valid JSON object with "subject" and "body" keys. Do NOT wrap the JSON in markdown code blocks.
{
  "subject": "Re: Quick question, ${firstName}",
  "body": "Hi ${firstName},\\n\\nJust checking in..."
}`;
  } else {
    prompt = `Write a final "closing the loop" cold email (Step 3) to a business owner.
Our service is "AI Google Reviews Automation".

Lead Details:
- First Name: ${firstName}
- Business Name: ${businessName}

Goal: A soft closing email. Keep it extremely brief (under 50 words) and polite, saying we will close the loop but they can reply if they ever want to explore. Include the plain text notice at the bottom "Reply STOP to opt out".

Response format:
Provide the output as a valid JSON object with "subject" and "body" keys. Do NOT wrap the JSON in markdown code blocks.
{
  "subject": "Closing the loop — ${businessName}",
  "body": "Hi ${firstName},\\n\\nI'll keep this short..."
}`;
  }

  try {
    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";
    const response = await openrouter.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are an expert cold email copywriter who writes concise, personalized, plain-text emails that avoid spam filters. Return ONLY the raw JSON object with keys 'subject' and 'body'. Do not include any code block markup."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    });

    let content = response.choices[0]?.message?.content || "";
    content = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    const parsed = JSON.parse(content);
    return {
      subject: parsed.subject || `Quick question, ${firstName}`,
      body: parsed.body || `Hi ${firstName},\n\nHope you're doing well.`
    };
  } catch (error) {
    console.error("[EmailComposer] Failed to generate email using AI:", error);
    return getFallbackTemplate(lead, step);
  }
}

function getFallbackTemplate(lead, step) {
  const firstName = lead.ownerName && lead.ownerName !== "N/A" ? lead.ownerName : "there";
  const businessName = lead.name || "your business";
  const category = lead.category && lead.category !== "Unknown" ? lead.category : "business";
  const city = lead.location && lead.location !== "Unknown" ? lead.location : "your area";
  const rating = lead.rating && lead.rating !== "N/A" ? lead.rating : "3.5";
  const reviewCount = lead.reviewCount && lead.reviewCount !== "N/A" ? lead.reviewCount : "some";

  if (step === 1) {
    return {
      subject: `Quick question, ${firstName}`,
      body: `Hi ${firstName},\n\nI was checking out ${businessName} on Google — you've got ${reviewCount} reviews at ${rating}★, which for a ${category} in ${city} leaves a lot of room to stand out.\n\nWe built an AI that automatically collects reviews from your happy customers after every visit — completely hands-off for you.\n\nWorth a 10-min look?\n\nBest,\nSupa Automation\nsupaautomation.agency`
    };
  } else if (step === 2) {
    return {
      subject: `Re: Quick question, ${firstName}`,
      body: `Hi ${firstName},\n\nJust bumping this up in case it got buried.\n\nWe're helping ${category} businesses in ${city} get 2–3x more Google reviews every month on autopilot.\n\nHappy to show you exactly how it works — no pressure.\n\nBest,\nSupa Automation`
    };
  } else {
    return {
      subject: `Closing the loop — ${businessName}`,
      body: `Hi ${firstName},\n\nI'll keep this short. If automating your Google reviews is ever something you'd want to explore, I'm just a reply away.\n\nWishing ${businessName} all the best! 🙏\n\nReply STOP to opt out.\n\nBest,\nSupa Automation`
    };
  }
}
