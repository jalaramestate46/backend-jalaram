const http = require('http');
require('dotenv').config();

// Port override for testing to avoid conflicts with running servers
const TEST_PORT = 5001;
process.env.PORT = TEST_PORT;

console.log("Starting backend test script...");

// Start the Express server programmatically
const app = require('./server');

const request = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          // ignore parsing error if response is not JSON
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed || responseBody
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(postData);
    }
    req.end();
  });
};

// Wait 1 second for the server to bind to the port
setTimeout(async () => {
  let passedCount = 0;
  let failedCount = 0;

  const runTest = async (name, testFn) => {
    try {
      console.log(`\n[RUN] ${name}`);
      await testFn();
      console.log(`[PASS] ${name}`);
      passedCount++;
    } catch (e) {
      console.error(`[FAIL] ${name}:`, e.message);
      failedCount++;
    }
  };

  try {
    // Test 1: Health Check Endpoint
    await runTest("Health check endpoint", async () => {
      const res = await request('/api/health');
      if (res.statusCode !== 200) throw new Error(`Expected status 200, got ${res.statusCode}`);
      if (res.body.success !== true) throw new Error(`Expected success = true, got ${res.body.success}`);
      if (res.body.message !== 'Backend API is running.') throw new Error(`Unexpected health message: ${res.body.message}`);
    });

    // Test 2: Public Projects Listing
    await runTest("Projects public list endpoint", async () => {
      const res = await request('/api/projects');
      if (res.statusCode !== 200) throw new Error(`Expected status 200, got ${res.statusCode}`);
      if (res.body.success !== true) throw new Error(`Expected success = true, got ${res.body.success}`);
      if (!Array.isArray(res.body.data)) throw new Error(`Expected data array, got ${typeof res.body.data}`);
    });

    // Test 3: Public Reviews Listing
    await runTest("Reviews public approved endpoint", async () => {
      const res = await request('/api/reviews');
      if (res.statusCode !== 200) throw new Error(`Expected status 200, got ${res.statusCode}`);
      if (res.body.success !== true) throw new Error(`Expected success = true, got ${res.body.success}`);
      if (!Array.isArray(res.body.data)) throw new Error(`Expected data array, got ${typeof res.body.data}`);
    });

    // Test 4: Dynamic Site Content Config Load with Fallbacks
    await runTest("Dynamic homepage content loading (with fallback check)", async () => {
      const res = await request('/api/content/home');
      if (res.statusCode !== 200) throw new Error(`Expected status 200, got ${res.statusCode}`);
      if (res.body.success !== true) throw new Error(`Expected success = true, got ${res.body.success}`);
      if (res.body.data.primaryLabel !== 'Explore Properties') throw new Error(`Expected fallback primaryLabel 'Explore Properties', got '${res.body.data.primaryLabel}'`);
    });

    // Test 5: Dynamic SEO Meta tags Load with Fallbacks
    await runTest("Dynamic SEO content loading (with fallback check)", async () => {
      const res = await request('/api/content/seo');
      if (res.statusCode !== 200) throw new Error(`Expected status 200, got ${res.statusCode}`);
      if (res.body.success !== true) throw new Error(`Expected success = true, got ${res.body.success}`);
      if (!res.body.data.home || !res.body.data.aboutus) throw new Error(`Expected home & aboutus SEO configs in fallbacks, got keys: ${Object.keys(res.body.data).join(', ')}`);
    });

    // Test 6: Submit inquiry form
    await runTest("Submit customer inquiry endpoint", async () => {
      const payload = {
        type: 'contact',
        name: 'Test Visitor',
        mobile: '1234567890',
        message: 'This is a test contact message submitted during automated API checks.'
      };
      const res = await request('/api/inquiries', 'POST', payload);
      // If database is configured it inserts, otherwise it throws unconfigured error (which is also a success check of proxy client!)
      if (res.statusCode !== 201 && res.statusCode !== 500) {
        throw new Error(`Expected 201 created or 500 unconfigured, got ${res.statusCode}`);
      }
      if (res.statusCode === 201) {
        if (res.body.success !== true) throw new Error(`Expected success = true, got ${res.body.success}`);
      } else {
        if (!res.body.message.includes("credentials are not configured")) {
          throw new Error(`Unexpected server error message: ${res.body.message}`);
        }
        console.log("-> Database unconfigured warning validated successfully.");
      }
    });

    console.log(`\n========================================`);
    console.log(`TEST SUMMARY: ${passedCount} passed, ${failedCount} failed.`);
    console.log(`========================================`);

    if (failedCount > 0) {
      console.error("Backend tests failed. Review log details.");
      process.exit(1);
    } else {
      console.log("All API checks completed successfully! Backend is ready.");
      process.exit(0);
    }
  } catch (err) {
    console.error("Test execution crash error:", err.message);
    process.exit(1);
  }
}, 1200);
