/**
 * System prompt for sentiment analysis and crisis detection
 */
export const SENTIMENT_ANALYSIS_PROMPT = `Analyze the following message for sentiment and crisis indicators. 
Return a JSON object with:
- sentiment: "positive", "neutral", or "negative"
- crisisIndicators: array of detected crisis keywords/phrases (e.g., ["suicidal ideation", "self-harm"])
- confidence: number between 0 and 1

Be conservative - only flag clear crisis indicators.`
