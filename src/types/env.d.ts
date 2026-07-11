declare namespace NodeJS {
  interface ProcessEnv {
    MONGO_URI: string;
    PORT?: string;
    HOST?: string;
    JWT_SECRET: string;
    PAYHERE_MERCHANT_ID?: string;
    PAYHERE_MERCHANT_SECRET?: string;
    BACKEND_URL?: string;
    EMAIL_USER?: string;
    EMAIL_PASS?: string;
    FIREBASE_PROJECT_ID?: string;
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
  }
}
