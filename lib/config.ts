// /lib/config.ts
export const config = {
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001",
    env: process.env.NODE_ENV || "development",
    isDevelopment: process.env.NODE_ENV === "development",
    isProduction: process.env.NODE_ENV === "production",
  },

  upload: {
    maxSize: Number.parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE || "5242880"), // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },

  reports: {
    pdfTimeout: Number.parseInt(process.env.NEXT_PUBLIC_PDF_GENERATION_TIMEOUT || "30000"),
  },
} as const;

export type Config = typeof config;
