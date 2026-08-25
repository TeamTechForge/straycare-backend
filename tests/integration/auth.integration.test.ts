import request from 'supertest';
import { setupTestDB } from '../setupIntegration';
import User from '../../src/models/User';
import { validRegistrationPayload, validLoginPayload } from '../fixtures/auth.fixture';

// We require the app rather than import to work with commonjs exports in ts
const app = require('../../src/app');

// Setup in-memory DB and reset collections after each test
setupTestDB();

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return 201', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationPayload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('name', validRegistrationPayload.name);
      expect(response.body.user).toHaveProperty('email', validRegistrationPayload.email);
      expect(response.body.user).not.toHaveProperty('password'); // password should not be returned

      // Verify the user was actually saved in DB
      const dbUser = await User.findOne({ email: validRegistrationPayload.email });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.password).not.toBe(validRegistrationPayload.password); // Should be hashed
    });

    it('should return 400 if user already exists', async () => {
      // Register first time
      await request(app).post('/api/auth/register').send(validRegistrationPayload);

      // Register second time
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationPayload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email already registered');
    });

    it('should return 400 for invalid registration payload', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validRegistrationPayload, password: '123' }); // Too short password

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Password must be 8-15 characters long, and contain at least one uppercase letter and one symbol');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Pre-register user for login tests
      await request(app).post('/api/auth/register').send(validRegistrationPayload);
    });

    it('should login an existing user and return 200 with tokens', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginPayload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', validLoginPayload.email);
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: validLoginPayload.email, password: 'WrongPassword123' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid email or password');
    });

    it('should return 404 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notfound@example.com', password: 'Password123!' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Account not found');
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeEach(async () => {
      // Pre-register user and capture token
      const res = await request(app).post('/api/auth/register').send(validRegistrationPayload);
      token = res.body.token;
    });

    it('should return the current user profile if token is valid', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', validRegistrationPayload.email);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 401 if token is missing', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Access denied. No token provided.');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer some-fake-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid or expired token');
    });
  });
});
