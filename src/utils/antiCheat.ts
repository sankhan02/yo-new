/**
 * Anti-Cheat Utility for YoMama Game
 * 
 * This utility provides methods to detect and prevent cheating in multiplayer matches.
 * It includes server-side validation, client-side monitoring, and rate limiting.
 */

import { ref } from 'vue';

// Types
export interface ClickData {
  timestamp: number;
  position?: { x: number, y: number };
}

export interface CheatDetectionResult {
  isValid: boolean;
  reason?: string;
  severity?: 'warning' | 'moderate' | 'severe';
}

// Constants
const MAX_CLICKS_PER_SECOND = 15;
const MIN_CLICK_INTERVAL_MS = 50; // 50ms minimum between clicks
const MAX_PATTERN_SIMILARITY = 0.8; // 80% similarity threshold
const SUSPICIOUS_WINDOW_SIZE = 20; // Number of clicks to analyze

// State
const clickHistory = ref<ClickData[]>([]);
const warningCount = ref(0);
const lastReportedTime = ref(0);

/**
 * Records a click and validates it against cheating patterns
 * @param position Optional click position
 * @returns Detection result
 */
export function recordClick(position?: { x: number, y: number }): CheatDetectionResult {
  const timestamp = Date.now();
  const clickData: ClickData = { timestamp, position };
  
  // Add to history
  clickHistory.value.push(clickData);
  
  // Keep history at a reasonable size
  if (clickHistory.value.length > 100) {
    clickHistory.value = clickHistory.value.slice(-100);
  }
  
  // Validate click
  return validateClick(clickData);
}

/**
 * Validates a click against multiple cheat detection strategies
 */
function validateClick(clickData: ClickData): CheatDetectionResult {
  const results: CheatDetectionResult[] = [];
  
  // Run all detection algorithms
  results.push(detectAutoClicker(clickData));
  results.push(detectPatternedClicks());
  
  // Find the most severe result
  const invalid = results.find(r => !r.isValid);
  if (invalid) {
    handleCheatDetection(invalid);
    return invalid;
  }
  
  return { isValid: true };
}

/**
 * Detects if an auto-clicker is being used
 */
function detectAutoClicker(clickData: ClickData): CheatDetectionResult {
  // Not enough data yet
  if (clickHistory.value.length < 5) {
    return { isValid: true };
  }
  
  // Check for clicks that are too rapid
  const recentClicks = clickHistory.value.slice(-10);
  const intervals: number[] = [];
  
  // Calculate intervals between clicks
  for (let i = 1; i < recentClicks.length; i++) {
    intervals.push(recentClicks[i].timestamp - recentClicks[i-1].timestamp);
  }
  
  // Check for too rapid clicking
  const tooRapid = intervals.some(interval => interval < MIN_CLICK_INTERVAL_MS);
  if (tooRapid) {
    return { 
      isValid: false, 
      reason: 'Clicking too rapidly', 
      severity: 'moderate' 
    };
  }
  
  // Check click rate over the last second
  const oneSecondAgo = Date.now() - 1000;
  const clicksInLastSecond = clickHistory.value.filter(c => c.timestamp > oneSecondAgo).length;
  
  if (clicksInLastSecond > MAX_CLICKS_PER_SECOND) {
    return { 
      isValid: false, 
      reason: 'Too many clicks per second', 
      severity: 'moderate' 
    };
  }
  
  return { isValid: true };
}

/**
 * Detects if clicks follow an algorithmic pattern
 */
function detectPatternedClicks(): CheatDetectionResult {
  if (clickHistory.value.length < SUSPICIOUS_WINDOW_SIZE) {
    return { isValid: true };
  }
  
  const recentClicks = clickHistory.value.slice(-SUSPICIOUS_WINDOW_SIZE);
  const intervals: number[] = [];
  
  // Calculate intervals
  for (let i = 1; i < recentClicks.length; i++) {
    intervals.push(recentClicks[i].timestamp - recentClicks[i-1].timestamp);
  }
  
  // Check for consistent intervals (bot behavior)
  const isConsistent = detectConsistentIntervals(intervals);
  if (isConsistent) {
    return { 
      isValid: false, 
      reason: 'Suspiciously consistent clicking pattern', 
      severity: 'severe' 
    };
  }
  
  // Check for position patterns if position data exists
  if (recentClicks[0].position) {
    const hasPositionPattern = detectPositionPattern(recentClicks);
    if (hasPositionPattern) {
      return { 
        isValid: false, 
        reason: 'Suspiciously patterned click positions', 
        severity: 'severe' 
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Detects if the time intervals between clicks are suspiciously consistent
 */
function detectConsistentIntervals(intervals: number[]): boolean {
  if (intervals.length < 5) return false;
  
  // Calculate standard deviation
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const squareDiffs = intervals.map(val => Math.pow(val - mean, 2));
  const stdDev = Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / intervals.length);
  
  // If standard deviation is very low compared to mean, it's suspicious
  const coefficientOfVariation = stdDev / mean;
  return coefficientOfVariation < 0.1; // Less than 10% variation is suspicious
}

/**
 * Detects if click positions follow a pattern
 */
function detectPositionPattern(clicks: ClickData[]): boolean {
  // This is a simplified implementation
  // In a production environment, this would use more sophisticated pattern recognition
  
  if (!clicks[0].position) return false;
  
  // Check for clicks at exactly the same position
  const positions = clicks.map(c => c.position!);
  
  // Count unique positions
  const uniquePositions = new Set(
    positions.map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
  );
  
  // If there are very few unique positions compared to total clicks, it's suspicious
  return uniquePositions.size < positions.length * 0.3; // Less than 30% unique positions
}

/**
 * Handles a detected cheating attempt
 */
function handleCheatDetection(result: CheatDetectionResult): void {
  warningCount.value++;
  
  // Rate limit reporting to avoid spamming the server
  const now = Date.now();
  if (now - lastReportedTime.value > 10000) { // Only report every 10 seconds
    reportCheating(result);
    lastReportedTime.value = now;
  }
}

/**
 * Reports cheating to the server
 */
function reportCheating(result: CheatDetectionResult): void {
  console.warn(`[Anti-Cheat] Detected possible cheating: ${result.reason}`);
  
  // In production, this would send data to the server
  // For now, we're just logging it
  
  // Example of how server reporting would work:
  /*
  fetch('/api/anti-cheat/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: Date.now(),
      reason: result.reason,
      severity: result.severity,
      clickData: clickHistory.value.slice(-20),
      warningCount: warningCount.value
    })
  });
  */
}

/**
 * Resets the anti-cheat system state
 */
export function resetAntiCheatState(): void {
  clickHistory.value = [];
  warningCount.value = 0;
}

/**
 * Validates a match result before submitting to ensure fair play
 * @param playerScore The player's score
 * @param duration Match duration in seconds
 */
export function validateMatchResult(playerScore: number, duration: number): CheatDetectionResult {
  // Validate that the score is reasonable for the duration
  const maxReasonableScore = duration * (MAX_CLICKS_PER_SECOND * 0.8); // 80% of max theoretical
  
  if (playerScore > maxReasonableScore) {
    return {
      isValid: false,
      reason: 'Score exceeds reasonable maximum',
      severity: 'severe'
    };
  }
  
  // Check for warning count
  if (warningCount.value > 3) {
    return {
      isValid: false,
      reason: 'Multiple suspicious activities detected',
      severity: 'severe'
    };
  }
  
  return { isValid: true };
}

/**
 * Creates a server validation token to ensure the client hasn't been tampered with
 * In a real implementation, this would use cryptographic methods
 */
export function generateValidationToken(matchId: string, score: number): string {
  // In a real implementation, this would use a more secure method
  // For demonstration purposes only
  const timestamp = Date.now();
  return `${matchId}_${score}_${timestamp}`;
} 