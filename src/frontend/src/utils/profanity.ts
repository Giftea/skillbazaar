const BLOCKED: string[] = [
  "fuck", "shit", "ass", "bitch", "cunt", "dick", "pussy", "cock",
  "nigger", "nigga", "faggot", "fag", "whore", "slut", "bastard",
  "damn", "crap", "piss", "asshole", "motherfucker", "fucker",
  "bullshit", "jackass", "dumbass", "shithead", "dipshit",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/(.)\1{2,}/g, "$1");
}

export function containsProfanity(text: string): boolean {
  const cleaned = normalize(text);
  return BLOCKED.some((word) => {
    const pattern = new RegExp(`(?:^|[^a-z])${word}(?:[^a-z]|$)`);
    return pattern.test(cleaned);
  });
}
