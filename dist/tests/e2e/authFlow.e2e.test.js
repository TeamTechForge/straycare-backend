"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const setupIntegration_1 = require("../setupIntegration");
const auth_fixture_1 = require("../fixtures/auth.fixture");
const app = require('../../src/app');
(0, setupIntegration_1.setupTestDB)();
describe('E2E Auth Flow', () => {
    let token;
    it('should successfully complete the full authentication journey', async () => {
        // 1. Register
        const registerRes = await (0, supertest_1.default)(app)
            .post('/api/auth/register')
            .send(auth_fixture_1.validRegistrationPayload);
        expect(registerRes.status).toBe(201);
        expect(registerRes.body.user.email).toBe(auth_fixture_1.validRegistrationPayload.email);
        // 2. Login
        const loginRes = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({
            email: auth_fixture_1.validRegistrationPayload.email,
            password: auth_fixture_1.validRegistrationPayload.password,
        });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body).toHaveProperty('token');
        token = loginRes.body.token;
        // 3. Fetch Profile (Me)
        const profileRes = await (0, supertest_1.default)(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);
        expect(profileRes.status).toBe(200);
        expect(profileRes.body.email).toBe(auth_fixture_1.validRegistrationPayload.email);
    });
});
//# sourceMappingURL=authFlow.e2e.test.js.map