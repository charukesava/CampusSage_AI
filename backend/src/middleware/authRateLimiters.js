import rateLimit from "express-rate-limit";

const rateLimitResponse = (message) => ({
  message,
});

// Baseline protection for every API route. Route-specific limiters below
// provide stricter limits for operations that are especially expensive.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many requests. Please try again later.",
  ),
});

// Login rate limiter
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse("Too many login attempts. Please try again later."),
});

// Registration rate limiter
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many registration attempts. Please try again later.",
  ),
});

// Password change rate limiter
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many password change attempts. Please try again later.",
  ),
});

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many AI requests. Please try again later.",
  ),
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse(
    "Too many upload requests. Please try again later.",
  ),
});
