import { body, query, param } from 'express-validator';

// Payment method enum values
const PAYMENT_METHODS = ['paystack', 'stripe'];

// Withdrawal method enum values
const WITHDRAWAL_METHODS = ['bank'];

// Subscription type enum values
const SUBSCRIPTION_TYPES = ['one_time', 'monthly', 'yearly'];

/**
 * Validation for payment initialization
 */
export const validatePaymentInitialization = [
  body('communityId')
    .notEmpty()
    .withMessage('Community ID is required')
    .isMongoId()
    .withMessage('Invalid community ID format'),
  
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(PAYMENT_METHODS)
    .withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  
  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Payment amount must be between 0.01 and 1,000,000')
    .toFloat()
];

/**
 * Validation for payment verification
 */
export const validatePaymentVerification = [
  query('reference')
    .notEmpty()
    .withMessage('Payment reference is required')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Payment reference must be between 1 and 255 characters'),
  
  query('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(PAYMENT_METHODS)
    .withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`)
];

/**
 * Validation for withdrawal request
 */
export const validateWithdrawalRequest = [
  body('communityId')
    .notEmpty()
    .withMessage('Community ID is required')
    .isMongoId()
    .withMessage('Invalid community ID format'),
  
  body('amount')
    .notEmpty()
    .withMessage('Withdrawal amount is required')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Withdrawal amount must be between 0.01 and 1,000,000')
    .toFloat(),
  
  body('method')
    .notEmpty()
    .withMessage('Withdrawal method is required')
    .isIn(WITHDRAWAL_METHODS)
    .withMessage(`Withdrawal method must be one of: ${WITHDRAWAL_METHODS.join(', ')}`),
  
  body('details')
    .notEmpty()
    .withMessage('Withdrawal details are required')
    .isObject()
    .withMessage('Withdrawal details must be an object'),
  
  body('details.accountNumber')
    .if(body('method').equals('bank'))
    .notEmpty()
    .withMessage('Account number is required for bank withdrawals')
    .isLength({ min: 10, max: 10 })
    .withMessage('Account number must be 10 digits')
    .isNumeric()
    .withMessage('Account number must contain only digits'),
  
  body('details.bankCode')
    .if(body('method').equals('bank'))
    .notEmpty()
    .withMessage('Bank code is required for bank withdrawals')
    .isLength({ min: 3, max: 6 })
    .withMessage('Bank code must be between 3 and 6 characters'),
  
  body('details.accountName')
    .if(body('method').equals('bank'))
    .notEmpty()
    .withMessage('Account name is required for bank withdrawals')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account name must be between 2 and 100 characters')
];

/**
 * Validation for community settings updates (payment-related)
 */
export const validateCommunityPaymentSettings = [
  body('settings.payment.isPaidCommunity')
    .optional()
    .isBoolean()
    .withMessage('isPaidCommunity must be a boolean'),
  
  body('settings.payment.price')
    .if((value, { req }) => req.body.settings?.payment?.isPaidCommunity === true)
    .notEmpty()
    .withMessage('Price is required for paid communities')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('Price must be between 0.01 and 1,000,000')
    .toFloat(),
  
  body('settings.payment.currency')
    .if((value, { req }) => req.body.settings?.payment?.isPaidCommunity === true)
    .notEmpty()
    .withMessage('Currency is required for paid communities')
    .isIn(['NGN', 'USD', 'EUR', 'GBP'])
    .withMessage('Currency must be one of: NGN, USD, EUR, GBP'),
  
  body('settings.payment.subscriptionType')
    .if((value, { req }) => req.body.settings?.payment?.isPaidCommunity === true)
    .notEmpty()
    .withMessage('Subscription type is required for paid communities')
    .isIn(SUBSCRIPTION_TYPES)
    .withMessage(`Subscription type must be one of: ${SUBSCRIPTION_TYPES.join(', ')}`),
  
  body('settings.payment.paymentMethods')
    .if((value, { req }) => req.body.settings?.payment?.isPaidCommunity === true)
    .notEmpty()
    .withMessage('At least one payment method is required for paid communities')
    .isArray({ min: 1 })
    .withMessage('Payment methods must be a non-empty array'),
  
  body('settings.payment.paymentMethods.*')
    .if((value, { req }) => req.body.settings?.payment?.isPaidCommunity === true)
    .isIn(PAYMENT_METHODS)
    .withMessage(`Each payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  
  body('settings.payment.revenueShare')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Revenue share must be between 0 and 100')
    .toFloat()
];

/**
 * Validation for transaction history query
 */
export const validateTransactionQuery = [
  param('communityId')
    .notEmpty()
    .withMessage('Community ID is required')
    .isMongoId()
    .withMessage('Invalid community ID format'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];
