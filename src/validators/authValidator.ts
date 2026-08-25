// src/validators/authValidator.ts

export class AuthValidator {
  public static validatePassword(password: string): { isValid: boolean; message?: string } {
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,15}$/;
    if (!passwordRegex.test(password)) {
      return { isValid: false, message: "Password must be 8-15 characters long, and contain at least one uppercase letter and one symbol" };
    }
    return { isValid: true };
  }

  public static validateRegistrationPayload(payload: any): { isValid: boolean; message?: string } {
    const { name, email, phone, password } = payload;
    
    if (!name || !email || !phone || !password) {
      return { isValid: false, message: "All fields are required" };
    }

    const passwordCheck = this.validatePassword(password);
    if (!passwordCheck.isValid) {
      return passwordCheck;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: "Invalid email format" };
    }

    return { isValid: true };
  }
}
