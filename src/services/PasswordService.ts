import bcrypt from "bcryptjs";

export class PasswordService {
  /**
   * Securely hashes a plaintext password using the bcrypt algorithm.
   * 
   * @param password - The plaintext string to hash.
   * @param saltRounds - The computational cost factor for hashing. Defaults to 10.
   * @returns A promise resolving to the bcrypt hash string.
   */
  public static async hashPassword(password: string, saltRounds: number = 10): Promise<string> {
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compares a plaintext password attempt against a stored bcrypt hash.
   * 
   * @param password - The plaintext password attempt.
   * @param hash - The previously stored bcrypt hash.
   * @returns A promise resolving to true if they match, false otherwise.
   */
  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
