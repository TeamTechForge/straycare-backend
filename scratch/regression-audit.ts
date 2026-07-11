import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:5000';

interface TestResult {
  phase: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details?: any;
}

const results: TestResult[] = [];
let jwtToken = '';
let userId = '';

async function runTests() {
  console.log("Starting Regression Audit Suite...");

  // Phase 1: Health Check
  try {
    const res = await fetch(`${API_BASE}/ping`);
    if (res.ok) results.push({ phase: 'Phase 1', name: 'Ping Health Check', status: 'PASS' });
    else results.push({ phase: 'Phase 1', name: 'Ping Health Check', status: 'FAIL', details: res.status });
  } catch (e: any) {
    results.push({ phase: 'Phase 1', name: 'Ping Health Check', status: 'FAIL', details: e.message });
  }

  // Phase 2: Authentication
  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = `Pass123!`;
  try {
    // Register
    let res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: testEmail, phone: '1234567890', password: testPassword })
    });
    if (res.status === 201) {
      results.push({ phase: 'Phase 2', name: 'Register User', status: 'PASS' });
      const data: any = await res.json();
      jwtToken = data.token;
      userId = data.user.id;
    } else {
      results.push({ phase: 'Phase 2', name: 'Register User', status: 'FAIL', details: await res.text() });
    }

    // Login
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    if (res.status === 200) {
      results.push({ phase: 'Phase 2', name: 'Login User', status: 'PASS' });
      const data: any = await res.json();
      jwtToken = data.token;
    } else {
      results.push({ phase: 'Phase 2', name: 'Login User', status: 'FAIL', details: await res.text() });
    }
  } catch (e: any) {
    results.push({ phase: 'Phase 2', name: 'Auth Exceptions', status: 'FAIL', details: e.message });
  }

  // Phase 5: Community (Forum)
  try {
    const res = await fetch(`${API_BASE}/api/forum`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) results.push({ phase: 'Phase 5', name: 'Fetch Forum Posts', status: 'PASS' });
    else results.push({ phase: 'Phase 5', name: 'Fetch Forum Posts', status: 'FAIL', details: res.status });
  } catch (e: any) {
    results.push({ phase: 'Phase 5', name: 'Forum GET', status: 'FAIL', details: e.message });
  }

  // Phase 8: Rescue
  try {
    const res = await fetch(`${API_BASE}/api/rescue`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }
    });
    if (res.ok) results.push({ phase: 'Phase 8', name: 'Fetch Rescue Requests', status: 'PASS' });
    else results.push({ phase: 'Phase 8', name: 'Fetch Rescue Requests', status: 'FAIL', details: await res.text() });
  } catch (e: any) {
    results.push({ phase: 'Phase 8', name: 'Rescue GET', status: 'FAIL', details: e.message });
  }

  // Phase 4: Reports (Stray Reports)
  try {
    const res = await fetch(`${API_BASE}/api/stray`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }
    });
    if (res.ok) results.push({ phase: 'Phase 4', name: 'Fetch Stray Reports', status: 'PASS' });
    else results.push({ phase: 'Phase 4', name: 'Fetch Stray Reports', status: 'FAIL', details: await res.text() });
  } catch (e: any) {
    results.push({ phase: 'Phase 4', name: 'Stray Reports GET', status: 'FAIL', details: e.message });
  }

  // Phase 13: Routes (Check some known bad route)
  try {
    const res = await fetch(`${API_BASE}/api/does-not-exist`);
    if (res.status === 404) results.push({ phase: 'Phase 13', name: '404 Fallback', status: 'PASS' });
    else results.push({ phase: 'Phase 13', name: '404 Fallback', status: 'FAIL', details: res.status });
  } catch (e: any) {
    results.push({ phase: 'Phase 13', name: '404 Route', status: 'FAIL', details: e.message });
  }

  // Save report
  fs.writeFileSync(path.join(__dirname, 'regression-report.json'), JSON.stringify(results, null, 2));
  console.log("Suite complete. Results saved.");
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASS: ${passed} | FAIL: ${failed}`);
  
  if (failed > 0) {
    console.error("Failed tests detected:", results.filter(r => r.status === 'FAIL'));
  }
}

runTests();
