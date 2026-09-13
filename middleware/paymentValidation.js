import { body, query, param } from 'express-validator';

/**
 * Whop is the only gateway for community membership.
 *
 * The legacy names are still ACCEPTED on input, because app builds already in
 * people's hands send `paystack` and rejecting them would break paying for a
 * community from those builds. They are then sanitised to `whop`, so nothing
 * downstream ever sees another gateway. `aeko_wallet` is settled internally
 * and never reaches a gateway, so it is deliberately absent here.
 */
const GATEWAY = 'whop';
const ACCEPTED_PAYMENT_METHODS = ['whop', 'paystack', 'stripe'];

// Withdrawal method enum values
const WITHDRAWAL_METHODS = ['bank'];

// Subscription type enum values
const SUBSCRIPTION_TYPES = ['one_time', 'monthly', 'yearly'];

/**
 * Record ids are UUIDs since the move to Postgres. These routes used
 * isMongoId, which rejects every UUID, so initializing a community payment
 * or requesting a withdrawal failed validation for every community. Ids
 * carried over from Mongo are still accepted.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONGO_ID_PATTERN = /^[0-9a-f]{24}$/i;
const isRecordId = (value) =>
  typeof value === 'string' && (UUID_PATTERN.test(value) || MONGO_ID_PATTERN.test(value));

/**
 * Validation for payment initialization
 */
export const validatePaymentInitialization = [
  body('communityId')
    .notEmpty()
    .withMessage('Community ID is required')
    .custom(isRecordId)
    .withMessage('Invalid community ID format'),

  body('paymentMethod')
    .optional()
    .isIn(ACCEPTED_PAYMENT_METHODS)
    .withMessage(`Payment method must be ${GATEWAY}`)
    .customSanitizer(() => GATEWAY),

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
    .optional()
    .isIn(ACCEPTED_PAYMENT_METHODS)
    .withMessage(`Payment method must be ${GATEWAY}`)
    .customSanitizer(() => GATEWAY)
];

/**
 * Validation for withdrawal request
 */
export const validateWithdrawalRequest = [
  body('communityId')
    .notEmpty()
    .withMessage('Community ID is required')
    .custom(isRecordId)
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

  // No longer required and no longer a choice: whatever an owner (or an older
  // app build) sends, a paid community is stored as Whop-only. A malformed
  // value is still rejected rather than silently rewritten.
  body('settings.payment.paymentMethods')
    .if((value, { req }) => req.body.settings?.payment?.isPaidCommunity === true)
    .custom((value) =>
      value === undefined ||
      (Array.isArray(value) && value.every((method) => typeof method === 'string'))
    )
    .withMessage('Payment methods must be an array of strings')
    .customSanitizer(() => [GATEWAY]),

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
    .custom(isRecordId)
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
