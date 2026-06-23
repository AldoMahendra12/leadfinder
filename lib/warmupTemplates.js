/**
 * Predefined templates for cold email warmup.
 * These are short, conversational, and non-salesy to mimic real human-to-human interaction.
 */
export const warmupTemplates = [
  {
    subject: "Quick question about your services",
    body: "Hi there,\n\nI was browsing your website and had a quick question about the services you offer. Do you have some time to chat this week?\n\nThanks,\nAlex"
  },
  {
    subject: "Are you accepting new projects?",
    body: "Hello,\n\nI'm looking for some help with a new project and wanted to check if you currently have availability. Let me know if we can connect.\n\nBest regards,\nJordan"
  },
  {
    subject: "Found your website on Google",
    body: "Hi,\n\nI came across your business while searching on Google today. I had a quick inquiry regarding your business hours and location. Could you let me know?\n\nThanks,\nTaylor"
  },
  {
    subject: "Meeting availability next week?",
    body: "Hi there,\n\nI hope you're having a good week. I wanted to see if you might be free for a brief 10-minute call next week to discuss a potential partnership.\n\nBest,\nSam"
  },
  {
    subject: "Quick feedback on your site",
    body: "Hello,\n\nI visited your website earlier today and noticed a couple of broken links. I thought I'd reach out and let you know. Let me know if you want me to send over the details.\n\nCheers,\nCasey"
  },
  {
    subject: "Inquiry about your pricing model",
    body: "Hi,\n\nCould you please send over your latest catalog or pricing details for business services? We are reviewing our vendors for next quarter.\n\nThanks,\nMorgan"
  },
  {
    subject: "Question about business automation",
    body: "Hello,\n\nI saw your profile online and wanted to ask if you offer customized automation solutions for local businesses. Let me know if you have a brief overview.\n\nRegards,\nRobin"
  }
];

export const warmupReplies = [
  "Hi, yes we do! I'd be happy to chat. What exactly are you looking for?",
  "Thanks for reaching out! Yes, we have availability. What does your project entail?",
  "Hey! Thanks for letting me know. We are open 9 AM to 5 PM, Monday to Friday. Let me know if you need anything else.",
  "Hi there, I would love to connect. Does Tuesday at 2 PM work for you?",
  "Oh wow, thank you so much for the heads up! Yes, please send over the broken links. Appreciate it!",
  "Hi! Sure, I can share our pricing sheet. What is the best number or email to send it to?",
  "Hello, yes we specialize in custom business automations. I'd love to learn more about what you need. Are you free for a call?"
];

/**
 * Returns a random warmup template.
 */
export function getRandomTemplate() {
  const index = Math.floor(Math.random() * warmupTemplates.length);
  return warmupTemplates[index];
}

/**
 * Returns a random reply text.
 */
export function getRandomReply() {
  const index = Math.floor(Math.random() * warmupReplies.length);
  return warmupReplies[index];
}
