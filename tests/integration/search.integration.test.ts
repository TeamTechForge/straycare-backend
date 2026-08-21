import request from 'supertest';
import { setupTestDB } from '../setupIntegration';
const User = require('../../src/models/User');
const NGOProfile = require('../../src/models/NGOProfile');
const VetProfile = require('../../src/models/VetProfile');

const app = require('../../src/app');

// Setup in-memory DB and reset collections after each test
setupTestDB();

describe('Search Integration Tests', () => {
  let authToken: string;

  beforeEach(async () => {
    // 1. Register a user to get a valid token since the endpoint is protected
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Search Tester',
        email: 'search@test.com',
        password: 'Password123!',
        phone: '+94770000000',
      });
    
    authToken = registerResponse.body.token;

    // 2. Seed database with test profiles
    // We need corresponding User records for the profiles because search uses $lookup on 'userId'
    const ngoUser = await User.create({ name: 'Animal Rescue Squad', email: 'ngo@test.com', password: 'pwd', role: 'ngo', phone: '+94770000001' });
    await NGOProfile.create({
      userId: ngoUser._id,
      orgName: 'Happy Tails Shelter',
      location: 'Colombo',
      bio: 'We rescue stray dogs',
      status: 'Verified',
      accountStatus: 'Active'
    });

    const vetUser = await User.create({ name: 'Smith', email: 'vet@test.com', password: 'pwd', role: 'vet', phone: '+94770000002' });
    await VetProfile.create({
      userId: vetUser._id,
      clinicName: 'Colombo Pet Clinic',
      primaryLocation: 'Colombo 7',
      bio: 'Expert in feline care',
      status: 'Verified',
      accountStatus: 'Active'
    });
  });

  it('should return 401 Unauthorized if no token is provided', async () => {
    const response = await request(app).get('/api/search?q=dogs');
    expect(response.status).toBe(401);
  });

  it('should return empty array for an empty query', async () => {
    const response = await request(app)
      .get('/api/search') // Missing 'q'
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('should find NGO profiles matching the query', async () => {
    const response = await request(app)
      .get('/api/search?q=shelter')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('name', 'Happy Tails Shelter');
    expect(response.body[0]).toHaveProperty('type', 'Animal Shelter');
  });

  it('should find Vet profiles matching the query', async () => {
    const response = await request(app)
      .get('/api/search?q=smith')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('name', 'Dr. Smith');
    expect(response.body[0]).toHaveProperty('type', 'Veterinarian');
  });

  it('should return mixed results combining both collections', async () => {
    const response = await request(app)
      .get('/api/search?q=Colombo')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
    // Extracts just the names to assert both were found
    const names = response.body.map((r: any) => r.name);
    expect(names).toContain('Happy Tails Shelter');
    expect(names).toContain('Dr. Smith');
  });
});
