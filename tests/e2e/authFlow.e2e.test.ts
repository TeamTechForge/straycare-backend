import request from 'supertest';
import { setupTestDB } from '../setupIntegration';
import { validRegistrationPayload } from '../fixtures/auth.fixture';

const app = require('../../src/app');

setupTestDB();

describe('E2E Auth Flow', () => {
  let token: string;

  it('should successfully complete the full authentication journey', async () => {
    // 1. Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(validRegistrationPayload);
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.email).toBe(validRegistrationPayload.email);

    // 2. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: validRegistrationPayload.email,
        password: validRegistrationPayload.password,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    
    token = loginRes.body.token;

    // 3. Fetch Profile (Me)
    const profileRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.email).toBe(validRegistrationPayload.email);
  });
});
