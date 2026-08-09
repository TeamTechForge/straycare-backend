import jwt from "jsonwebtoken";

export class JwtService {
  /**
   * Generates a securely signed JSON Web Token for stateless authentication.
   * 
   * @param payload - The user details or payload to encode inside the token.
   * @param expiresIn - Expiration time (e.g., "7d", "24h", or number in seconds). Defaults to "7d".
   * @returns The signed JWT string.
   * @throws {Error} If the JWT_SECRET environment variable is missing.
   */
  public static generateToken(payload: string | object | Buffer, expiresIn: string | number = "7d"): string {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured on the server");
    }
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn as any });
  }

  /**
   * Verifies a JSON Web Token and decodes its payload.
   * 
   * @param token - The raw JWT string from the authorization header.
   * @returns The decoded payload object.
   * @throws {Error} If the token is invalid, expired, or JWT_SECRET is missing.
   */
  public static verifyToken(token: string): any {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured on the server");
    }
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}
