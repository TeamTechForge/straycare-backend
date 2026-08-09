// src/validators/authValidator.ts

export class AuthValidator {
  /**
   * Validates the core fields required for registration.
   */
  public static validateRegistrationPayload(payload: any): { isValid: boolean; message?: string } {
    const { name, email, phone, password } = payload;
    
    if (!name || !email || !phone || !password) {
      return { isValid: false, message: "All fields are required" };
    }

    if (password.length < 6) {
      return { isValid: false, message: "Password must be at least 6 characters long" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: "Invalid email format" };
    }

    return { isValid: true };
  }
}
