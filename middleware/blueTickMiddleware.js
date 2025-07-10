import emailService from '../services/emailService.js';

// Middleware to check and award blue tick after profile updates
export const checkBlueTickEligibility = async (req, res, next) => {
    // This middleware runs after user updates that might affect profile completion
    
    // Get the user from the response (if it was attached by the route handler)
    const user = res.locals.user || req.user;
    
    if (!user) {
        return next();
    }

    try {
        // Check if user just became eligible for blue tick
        const wasNotVerified = !user.blueTick;
        const isNowEligible = user.profileCompletion.completionPercentage === 100;
        
        if (wasNotVerified && isNowEligible && user.blueTick) {
            // User just earned their blue tick!
            console.log(`🎉 User ${user.username} just earned their blue tick!`);
            
            // Send congratulations email
            try {
                await emailService.sendBlueTickNotification(user.email, user.name);
            } catch (emailError) {
                console.error('Failed to send blue tick notification email:', emailError);
                // Don't fail the request if email fails
            }
            
            // You could also trigger other notifications here:
            // - In-app notification
            // - Push notification
            // - Social media auto-post
            // - Analytics event
            
            // Add a success message to the response
            if (res.locals.messages) {
                res.locals.messages.push('🎉 Congratulations! You earned your Blue Tick!');
            } else {
                res.locals.messages = ['🎉 Congratulations! You earned your Blue Tick!'];
            }
        }
        
        next();
        
    } catch (error) {
        console.error('Blue tick middleware error:', error);
        // Don't fail the request due to middleware error
        next();
    }
};

// Middleware specifically for user updates (profile, wallet connection, etc.)
export const handleProfileUpdate = async (req, res, next) => {
    try {
        // Store the original handler
        const originalSend = res.send;
        const originalJson = res.json;
        
        // Override res.send and res.json to capture the user data
        res.send = function(data) {
            // Try to extract user from response
            if (typeof data === 'object' && data.user) {
                res.locals.user = data.user;
            }
            return originalSend.call(this, data);
        };
        
        res.json = function(data) {
            // Try to extract user from response
            if (typeof data === 'object' && data.user) {
                res.locals.user = data.user;
            } else if (typeof data === 'object' && data.success && data.data && data.data.user) {
                res.locals.user = data.data.user;
            }
            return originalJson.call(this, data);
        };
        
        next();
    } catch (error) {
        console.error('Profile update middleware error:', error);
        next();
    }
};

// Function to manually check and update blue tick for a user
export const checkAndUpdateBlueTick = async (user) => {
    try {
        const wasNotVerified = !user.blueTick;
        
        // Recalculate profile completion
        user.profileCompletion.hasProfilePicture = !!user.profilePicture;
        user.profileCompletion.hasBio = !!user.bio && user.bio.length > 10;
        user.profileCompletion.hasFollowers = user.followers.length > 0;
        user.profileCompletion.hasWalletConnected = !!user.solanaWalletAddress;
        user.profileCompletion.hasVerifiedEmail = user.emailVerification.isVerified;
        
        const requirements = [
            user.profileCompletion.hasProfilePicture,
            user.profileCompletion.hasBio,
            user.profileCompletion.hasFollowers,
            user.profileCompletion.hasWalletConnected,
            user.profileCompletion.hasVerifiedEmail
        ];
        
        const completedCount = requirements.filter(req => req).length;
        user.profileCompletion.completionPercentage = Math.round((completedCount / requirements.length) * 100);
        
        // Award blue tick if all requirements are met
        if (completedCount === requirements.length && !user.blueTick) {
            user.blueTick = true;
            user.profileCompletion.completedAt = new Date();
            
            // Send notification
            if (wasNotVerified) {
                try {
                    await emailService.sendBlueTickNotification(user.email, user.name);
                } catch (emailError) {
                    console.error('Failed to send blue tick notification:', emailError);
                }
            }
            
            console.log(`🎉 Blue tick awarded to user: ${user.username}`);
            return true; // Blue tick was awarded
        }
        
        return false; // Blue tick was not awarded
        
    } catch (error) {
        console.error('Error checking blue tick eligibility:', error);
        return false;
    }
};

// Get next steps for profile completion
export const getProfileCompletionSteps = (user) => {
    const steps = [];
    
    if (!user.profileCompletion.hasVerifiedEmail) {
        steps.push({
            step: 'verify_email',
            title: 'Verify Your Email',
            description: 'Confirm your email address to secure your account',
            completed: false,
            action: 'Click the verification link in your email or request a new code'
        });
    }
    
    if (!user.profileCompletion.hasProfilePicture) {
        steps.push({
            step: 'add_picture',
            title: 'Add Profile Picture',
            description: 'Upload a photo to personalize your profile',
            completed: false,
            action: 'Go to profile settings and upload an image'
        });
    }
    
    if (!user.profileCompletion.hasBio) {
        steps.push({
            step: 'write_bio',
            title: 'Write Your Bio',
            description: 'Tell others about yourself (minimum 10 characters)',
            completed: false,
            action: 'Add a description in your profile settings'
        });
    }
    
    if (!user.profileCompletion.hasWalletConnected) {
        steps.push({
            step: 'connect_wallet',
            title: 'Connect Solana Wallet',
            description: 'Link your wallet to use Aeko Coin and NFT features',
            completed: false,
            action: 'Connect your Phantom, Solflare, or other Solana wallet'
        });
    }
    
    if (!user.profileCompletion.hasFollowers) {
        steps.push({
            step: 'get_followers',
            title: 'Get Your First Follower',
            description: 'Build your audience by connecting with others',
            completed: false,
            action: 'Share interesting content and engage with the community'
        });
    }
    
    // Mark completed steps
    const completedSteps = [
        { key: 'hasVerifiedEmail', step: 'verify_email' },
        { key: 'hasProfilePicture', step: 'add_picture' },
        { key: 'hasBio', step: 'write_bio' },
        { key: 'hasWalletConnected', step: 'connect_wallet' },
        { key: 'hasFollowers', step: 'get_followers' }
    ];
    
    completedSteps.forEach(({ key, step }) => {
        if (user.profileCompletion[key]) {
            const stepIndex = steps.findIndex(s => s.step === step);
            if (stepIndex === -1) {
                // Add completed step
                steps.push({
                    step,
                    title: getStepTitle(step),
                    description: getStepDescription(step),
                    completed: true,
                    completedAt: user.profileCompletion.completedAt || new Date()
                });
            }
        }
    });
    
    return steps.sort((a, b) => {
        // Completed steps first, then by predefined order
        if (a.completed && !b.completed) return -1;
        if (!a.completed && b.completed) return 1;
        return 0;
    });
};

// Helper functions
function getStepTitle(step) {
    const titles = {
        verify_email: 'Verify Your Email',
        add_picture: 'Add Profile Picture',
        write_bio: 'Write Your Bio',
        connect_wallet: 'Connect Solana Wallet',
        get_followers: 'Get Your First Follower'
    };
    return titles[step] || 'Complete Profile Step';
}

function getStepDescription(step) {
    const descriptions = {
        verify_email: 'Email address confirmed',
        add_picture: 'Profile picture uploaded',
        write_bio: 'Bio added to profile',
        connect_wallet: 'Solana wallet connected',
        get_followers: 'First follower gained'
    };
    return descriptions[step] || 'Profile step completed';
}

export default {
    checkBlueTickEligibility,
    handleProfileUpdate,
    checkAndUpdateBlueTick,
    getProfileCompletionSteps
};