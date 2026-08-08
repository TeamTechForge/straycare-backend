"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const setupIntegration_1 = require("../setupIntegration");
const User_1 = __importDefault(require("../../src/models/User"));
const app = require('../../src/app');
// Setup in-memory DB to sandbox the E2E tests
(0, setupIntegration_1.setupTestDB)();
describe('E2E: Profile Creation Flow', () => {
    let authToken;
    const registrationPayload = {
        name: 'E2E User',
        email: 'e2e@test.com',
        password: 'SecurePassword123!',
        phone: '+94775555555',
    };
    it('should complete the full flow: Register -> Assign Role -> Create Profile -> View Profile', async () => {
        // ---------------------------------------------------------
        // STEP 1: User Registration
        // ---------------------------------------------------------
        const registerResponse = await (0, supertest_1.default)(app)
            .post('/api/auth/register')
            .send(registrationPayload);
        expect(registerResponse.status).toBe(201);
        expect(registerResponse.body).toHaveProperty('token');
        // Save token for authenticated requests
        authToken = registerResponse.body.token;
        // ---------------------------------------------------------
        // STEP 2: Manually upgrade to Volunteer Role & Re-Login
        // (Simulating an admin action or role selection process)
        // ---------------------------------------------------------
        await User_1.default.updateOne({ email: registrationPayload.email }, { role: 'volunteer' });
        // We must re-login to get a fresh JWT token that contains the new 'volunteer' role
        const loginResponse = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({ email: registrationPayload.email, password: registrationPayload.password });
        expect(loginResponse.status).toBe(200);
        authToken = loginResponse.body.token;
        // ---------------------------------------------------------
        // STEP 3: Create Volunteer Profile
        // ---------------------------------------------------------
        const profilePayload = {
            location: 'Galle, Sri Lanka',
            bio: 'E2E Testing Bio',
            profileImage: 'http://example.com/e2e-volunteer.jpg',
            name: 'E2E User Updated',
            latitude: 6.0535,
            longitude: 80.2210
        };
        const createProfileResponse = await (0, supertest_1.default)(app)
            .post('/api/profiles/volunteer')
            .set('Authorization', `Bearer ${authToken}`)
            .send(profilePayload);
        expect(createProfileResponse.status).toBe(201);
        expect(createProfileResponse.body).toHaveProperty('message', 'Volunteer profile created');
        expect(createProfileResponse.body.profile).toHaveProperty('bio', 'E2E Testing Bio');
        // ---------------------------------------------------------
        // STEP 4: Fetch Created Profile (Self)
        // ---------------------------------------------------------
        const fetchProfileResponse = await (0, supertest_1.default)(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${authToken}`);
        expect(fetchProfileResponse.status).toBe(200);
        expect(fetchProfileResponse.body).toHaveProperty('location', 'Galle, Sri Lanka');
        expect(fetchProfileResponse.body).toHaveProperty('profileImage', 'http://example.com/e2e-volunteer.jpg');
        // ---------------------------------------------------------
        // STEP 5: Verify Base User state was updated successfully
        // ---------------------------------------------------------
        const userInDb = await User_1.default.findOne({ email: registrationPayload.email });
        expect(userInDb?.profileCompleted).toBe(true);
        expect(userInDb?.profileImage).toBe('http://example.com/e2e-volunteer.jpg');
    });
});
//# sourceMappingURL=profileFlow.e2e.test.js.map