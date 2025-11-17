import { body, validationResult } from 'express-validator';
import {
  validatePaymentInitialization,
  validatePaymentVerification,
  validateWithdrawalRequest,
  validateCommunityPaymentSettings
} from './middleware/paymentValidation.js';

/**
 * Test script to verify payment validation rules
 * Usage: node test-payment-validation.js
 */

// Mock request and response objects
function createMockReq(body = {}, query = {}, params = {}) {
  return { body, query, params };
}

function createMockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
}

async function runValidation(validators, req) {
  // Run all validators
  for (const validator of validators) {
    await validator.run(req);
  }
  
  // Get validation results
  const errors = validationResult(req);
  return errors;
}

async function testPaymentInitialization() {
  console.log('\n📝 Testing Payment Initialization Validation...');
  
  // Test valid input
  const validReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    paymentMethod: 'paystack',
    amount: 100
  });
  
  let errors = await runValidation(validatePaymentInitialization, validReq);
  console.log('✅ Valid input:', errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Errors:', errors.array());
  
  // Test invalid payment method
  const invalidMethodReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    paymentMethod: 'invalid_method'
  });
  
  errors = await runValidation(validatePaymentInitialization, invalidMethodReq);
  console.log('✅ Invalid payment method:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
  
  // Test invalid amount
  const invalidAmountReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    paymentMethod: 'paystack',
    amount: 0
  });
  
  errors = await runValidation(validatePaymentInitialization, invalidAmountReq);
  console.log('✅ Invalid amount (too low):', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
  
  // Test amount too high
  const tooHighAmountReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    paymentMethod: 'paystack',
    amount: 2000000
  });
  
  errors = await runValidation(validatePaymentInitialization, tooHighAmountReq);
  console.log('✅ Invalid amount (too high):', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
}

async function testWithdrawalValidation() {
  console.log('\n📝 Testing Withdrawal Validation...');
  
  // Test valid bank withdrawal
  const validBankReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    amount: 5000,
    method: 'bank',
    details: {
      accountNumber: '1234567890',
      bankCode: '058',
      accountName: 'John Doe'
    }
  });
  
  let errors = await runValidation(validateWithdrawalRequest, validBankReq);
  console.log('✅ Valid bank withdrawal:', errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Errors:', errors.array());
  
  // Test invalid withdrawal method
  const invalidMethodReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    amount: 5000,
    method: 'paypal',
    details: {}
  });
  
  errors = await runValidation(validateWithdrawalRequest, invalidMethodReq);
  console.log('✅ Invalid withdrawal method:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
  
  // Test missing bank details
  const missingDetailsReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    amount: 5000,
    method: 'bank',
    details: {}
  });
  
  errors = await runValidation(validateWithdrawalRequest, missingDetailsReq);
  console.log('✅ Missing bank details:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
  
  // Test invalid amount
  const invalidAmountReq = createMockReq({
    communityId: '507f1f77bcf86cd799439011',
    amount: 0,
    method: 'bank',
    details: {
      accountNumber: '1234567890',
      bankCode: '058',
      accountName: 'John Doe'
    }
  });
  
  errors = await runValidation(validateWithdrawalRequest, invalidAmountReq);
  console.log('✅ Invalid withdrawal amount:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
}

async function testCommunityPaymentSettings() {
  console.log('\n📝 Testing Community Payment Settings Validation...');
  
  // Test valid paid community settings
  const validPaidReq = createMockReq({
    settings: {
      payment: {
        isPaidCommunity: true,
        price: 1000,
        currency: 'NGN',
        subscriptionType: 'monthly',
        paymentMethods: ['paystack', 'stripe']
      }
    }
  });
  
  let errors = await runValidation(validateCommunityPaymentSettings, validPaidReq);
  console.log('✅ Valid paid community settings:', errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Errors:', errors.array());
  
  // Test invalid subscription type
  const invalidSubTypeReq = createMockReq({
    settings: {
      payment: {
        isPaidCommunity: true,
        price: 1000,
        currency: 'NGN',
        subscriptionType: 'weekly',
        paymentMethods: ['paystack']
      }
    }
  });
  
  errors = await runValidation(validateCommunityPaymentSettings, invalidSubTypeReq);
  console.log('✅ Invalid subscription type:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
  
  // Test missing price for paid community
  const missingPriceReq = createMockReq({
    settings: {
      payment: {
        isPaidCommunity: true,
        currency: 'NGN',
        subscriptionType: 'monthly',
        paymentMethods: ['paystack']
      }
    }
  });
  
  errors = await runValidation(validateCommunityPaymentSettings, missingPriceReq);
  console.log('✅ Missing price for paid community:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
  
  // Test invalid payment method
  const invalidPaymentMethodReq = createMockReq({
    settings: {
      payment: {
        isPaidCommunity: true,
        price: 1000,
        currency: 'NGN',
        subscriptionType: 'monthly',
        paymentMethods: ['paystack', 'bitcoin']
      }
    }
  });
  
  errors = await runValidation(validateCommunityPaymentSettings, invalidPaymentMethodReq);
  console.log('✅ Invalid payment method in array:', !errors.isEmpty() ? 'PASS' : 'FAIL');
  if (!errors.isEmpty()) console.log('  Expected error:', errors.array()[0].msg);
}

async function runTests() {
  console.log('🧪 Starting Payment Validation Tests...');
  console.log('='.repeat(50));
  
  try {
    await testPaymentInitialization();
    await testWithdrawalValidation();
    await testCommunityPaymentSettings();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All validation tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
