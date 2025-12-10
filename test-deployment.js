#!/usr/bin/env node

/**
 * Deployment Test Script
 * Tests all major endpoints after deployment
 */

import axios from 'axios';

const BASE_URL = process.argv[2] || 'http://localhost:9876';

console.log(`🧪 Testing deployment at: ${BASE_URL}\n`);

const tests = [
  {
    name: 'Landing Page (HTML)',
    url: '/',
    expected: 200
  },
  {
    name: 'API Info (JSON)',
    url: '/api',
    expected: 200
  },
  {
    name: 'Project Info',
    url: '/api/info',
    expected: 200
  },
  {
    name: 'Health Check',
    url: '/api/health',
    expected: 200
  },
  {
    name: 'Available Routes',
    url: '/api/routes',
    expected: 200
  },
  {
    name: 'Swagger Docs',
    url: '/api-docs',
    expected: 200
  },
  {
    name: 'API Spec JSON',
    url: '/api-docs.json',
    expected: 200
  }
];

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const response = await axios.get(`${BASE_URL}${test.url}`, {
        timeout: 10000,
        validateStatus: () => true // Don't throw on non-2xx status
      });

      if (response.status === test.expected) {
        console.log(`✅ ${test.name}: ${response.status}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: Expected ${test.expected}, got ${response.status}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${tests.length}`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed! Deployment is working correctly.`);
  } else {
    console.log(`\n⚠️  Some tests failed. Check the logs above.`);
  }

  // Test specific API endpoints
  console.log(`\n🔍 Testing API Endpoints:`);
  
  const apiTests = [
    '/api/users',
    '/api/posts',
    '/api/auth/test'
  ];

  for (const endpoint of apiTests) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status < 500) {
        console.log(`✅ ${endpoint}: ${response.status} (${response.statusText})`);
      } else {
        console.log(`❌ ${endpoint}: ${response.status} (${response.statusText})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }
}

runTests().catch(console.error);