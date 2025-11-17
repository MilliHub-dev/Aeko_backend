# Subscription Expiration Notifications

## Overview

This feature automatically sends email notifications to users whose community subscriptions are expiring within 7 days. This helps maintain subscription renewals and provides a better user experience by giving advance notice.

## Implementation

### Files Created/Modified

1. **`jobs/subscriptionExpirationNotifications.js`** - Main notification logic
2. **`jobs/expireSubscriptions.js`** - Updated to include notification scheduler
3. **`server.js`** - Updated to import and initialize jobs
4. **`test-subscription-notifications.js`** - Test script for manual testing

### How It Works

#### Scheduled Job

The notification check runs daily at 9:00 AM (configurable via cron expression):

```javascript
cron.schedule("0 9 * * *", async () => {
  console.log("Checking for expiring subscriptions (7-day notice)...");
  await checkExpiringSubscriptions();
});
```

#### Notification Logic

1. **Query Paid Communities**: Finds all communities with `settings.payment.isPaidCommunity: true`

2. **Find Expiring Subscriptions**: For each community, identifies members whose subscriptions:
   - Are currently active (`subscription.isActive: true`)
   - Have an end date between now and 7 days from now

3. **Send Email Notifications**: For each expiring subscription:
   - Fetches user details (email, name, username)
   - Generates a personalized email with:
     - Days remaining until expiration
     - Community name and pricing information
     - Renewal link
     - Payment methods available
     - Benefits they'll lose if not renewed
   - Sends email via the existing `emailService`

4. **Logging**: Logs all notification events for analytics:
   - Successful notifications sent
   - Failed notifications
   - User and community details

### Email Template Features

The notification email includes:

- **Countdown Display**: Large, prominent display of days remaining
- **Expiration Date**: Full date when subscription expires
- **Pricing Information**: Current renewal price and subscription type
- **Payment Methods**: Available payment options (Paystack, Stripe, Aeko Wallet)
- **Benefits Reminder**: What the user will lose access to
- **Renewal Link**: Direct link to renew subscription
- **Professional Design**: Responsive HTML email with gradient headers and styled sections

## Configuration

### Environment Variables

Required environment variables (already configured in existing `.env`):

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:3000
```

### Cron Schedule

To change the notification time, modify the cron expression in `jobs/expireSubscriptions.js`:

```javascript
// Current: Daily at 9:00 AM
cron.schedule("0 9 * * *", async () => { ... });

// Examples:
// Daily at 8:00 AM: "0 8 * * *"
// Twice daily (9 AM and 5 PM): "0 9,17 * * *"
// Every Monday at 9 AM: "0 9 * * 1"
```

### Notification Window

To change the 7-day advance notice period, modify the calculation in `subscriptionExpirationNotifications.js`:

```javascript
// Current: 7 days
const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

// For 3 days: 
const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
```

## Testing

### Manual Testing

Run the test script to manually trigger the notification check:

```bash
node test-subscription-notifications.js
```

This will:
1. Connect to the database
2. Run the expiration check
3. Send notifications to any users with subscriptions expiring in 7 days
4. Display results (notifications sent/failed)

### Testing with Sample Data

To test the notification system:

1. **Create a test community** with paid membership enabled
2. **Add a test member** with a subscription ending in 7 days:

```javascript
// In MongoDB or via API
{
  subscription: {
    type: "monthly",
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isActive: true,
    paymentMethod: "paystack"
  }
}
```

3. **Run the test script** to trigger notifications
4. **Check the email** for the test user

### Automated Testing

The job runs automatically when the server starts. Monitor logs for:

```
[Subscription Notifications] Starting expiration check...
[Subscription Notifications] Sent to user@example.com for community Test Community
[Subscription Notifications] Check complete. Sent: 5, Failed: 0
```

## Analytics and Monitoring

### Log Events

All notification events are logged with the following information:

- Timestamp
- User email
- Community name
- Success/failure status
- Error messages (if failed)

### Metrics Tracked

The function returns metrics for monitoring:

```javascript
{
  success: true,
  notificationsSent: 5,
  notificationsFailed: 0
}
```

### Monitoring Recommendations

1. **Set up log aggregation** to track notification metrics over time
2. **Monitor failure rates** - investigate if failures exceed 5%
3. **Track renewal rates** - measure effectiveness of notifications
4. **Alert on high failure counts** - set up alerts if more than 10 notifications fail

## Error Handling

The implementation includes comprehensive error handling:

1. **Email Service Unavailable**: Gracefully handles missing email configuration
2. **User Not Found**: Skips and logs warning if user doesn't exist
3. **Missing Email**: Skips users without email addresses
4. **Email Send Failures**: Catches and logs individual email failures without stopping the batch
5. **Database Errors**: Catches and logs database query errors

## Requirements Satisfied

This implementation satisfies **Requirement 14.3**:

> WHERE subscriptions are about to expire, THE Membership System SHALL send notification emails 7 days before expiration

✅ **Scheduled job** checks for subscriptions expiring in 7 days  
✅ **Email notifications** sent to users with expiring subscriptions  
✅ **Renewal link** and pricing information included in notification  
✅ **Notification events** logged for analytics

## Future Enhancements

Potential improvements for future iterations:

1. **Multiple Notification Windows**: Send reminders at 7 days, 3 days, and 1 day before expiration
2. **SMS Notifications**: Add SMS support for critical expiration notices
3. **In-App Notifications**: Display expiration warnings in the app
4. **Customizable Templates**: Allow community owners to customize notification emails
5. **A/B Testing**: Test different notification timings and messaging
6. **Renewal Incentives**: Include discount codes or special offers in notifications
7. **Analytics Dashboard**: Build a dashboard to track notification and renewal metrics

## Troubleshooting

### Notifications Not Sending

1. **Check email configuration**:
   ```bash
   # Verify EMAIL_USER and EMAIL_PASS are set
   echo $EMAIL_USER
   ```

2. **Check cron job is running**:
   - Look for log messages at scheduled time
   - Verify server is running continuously

3. **Check for errors in logs**:
   ```bash
   # Search for notification errors
   grep "Subscription Notifications" logs/server.log
   ```

### Email Delivery Issues

1. **Gmail App Password**: Ensure using app-specific password, not regular password
2. **SMTP Settings**: Verify SMTP configuration in `emailService.js`
3. **Rate Limits**: Check if hitting Gmail sending limits (500 emails/day for free accounts)
4. **Spam Filters**: Check recipient spam folders

### Testing Issues

1. **No subscriptions found**: Ensure test data has subscriptions expiring in exactly 7 days
2. **Database connection**: Verify MongoDB is running and accessible
3. **Environment variables**: Ensure `.env` file is loaded correctly

## Support

For issues or questions:
- Check logs: `[Subscription Notifications]` prefix
- Review email service status: `emailService.isAvailable()`
- Contact: support@aeko.social
