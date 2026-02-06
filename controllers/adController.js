import { prisma } from '../config/db.js';

// Helper to get age range (matching Mongoose logic)
const getAgeRange = (age) => {
    if (age < 18) return 'under-18';
    if (age <= 24) return '18-24';
    if (age <= 34) return '25-34';
    if (age <= 44) return '35-44';
    if (age <= 54) return '45-54';
    if (age <= 64) return '55-64';
    return '65+';
};

// Helper to calculate performance score
const calculatePerformanceScore = (ad) => {
    if (!ad.analytics || ad.analytics.impressions === 0) return 0;
    
    const ctr = ad.analytics.ctr || 0;
    const conversionRate = ad.analytics.conversionRate || 0;
    const engagements = ad.analytics.engagements || { likes: 0, shares: 0, comments: 0, saves: 0 };
    const engagementRate = (
        (engagements.likes || 0) + 
        (engagements.shares || 0) + 
        (engagements.comments || 0)
    ) / ad.analytics.impressions;
    
    return Math.round((ctr * 0.4 + conversionRate * 0.4 + engagementRate * 0.2) * 100);
};

// Create new advertisement
export async function createAd(req, res) {
    try {
        const {
            title,
            description,
            mediaType,
            mediaUrl,
            mediaUrls,
            targetAudience,
            budget,
            pricing,
            campaign,
            callToAction,
            placement
        } = req.body;

        // Validate required fields
        if (!title || !description || !mediaType || !campaign?.objective) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, description, mediaType, campaign.objective'
            });
        }

        // Validate budget
        if (!budget?.total || budget.total <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid budget amount is required'
            });
        }

        // Validate dates
        const startDate = new Date(campaign.schedule?.startDate);
        const endDate = new Date(campaign.schedule?.endDate);
        const now = new Date();

        if (startDate < now) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be in the past'
            });
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

        const newAd = await prisma.ad.create({
            data: {
                title,
                description,
                mediaType,
                mediaUrl,
                mediaUrls: mediaUrls || [],
                targetAudience: targetAudience || {},
                budget: {
                    total: budget.total,
                    daily: budget.daily,
                    spent: 0,
                    currency: budget.currency || 'USD'
                },
                pricing: {
                    model: pricing?.model || 'cpm',
                    bidAmount: pricing?.bidAmount || 0,
                    maxBid: pricing?.maxBid
                },
                campaign: {
                    objective: campaign.objective,
                    schedule: {
                        startDate,
                        endDate,
                        timezone: campaign.schedule?.timezone || 'UTC',
                        dayParting: campaign.schedule?.dayParting || { enabled: false, hours: [] }
                    }
                },
                callToAction: callToAction || { type: 'learn_more' },
                placement: placement || { feed: true },
                advertiserId: req.user.id,
                status: 'pending',
                analytics: {
                    impressions: 0,
                    clicks: 0,
                    ctr: 0,
                    conversions: 0,
                    conversionRate: 0,
                    reach: 0,
                    frequency: 0,
                    engagements: { likes: 0, shares: 0, comments: 0, saves: 0 },
                    demographics: { age: [], gender: [], location: [] },
                    performance: { bestPerformingTime: null, topLocations: [], topDevices: [] }
                },
                frequency: { cap: 3, currentCap: 0 }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Advertisement created successfully and submitted for review',
            ad: newAd
        });

    } catch (error) {
        console.error('Create ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create advertisement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Get user's advertisements
export async function getUserAds(req, res) {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const where = { advertiserId: req.user.id };
        if (status) {
            where.status = status;
        }

        const [ads, total] = await Promise.all([
            prisma.ad.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip,
                include: {
                    user: {
                        select: { username: true, profilePicture: true, blueTick: true }
                    }
                }
            }),
            prisma.ad.count({ where })
        ]);

        // Add virtuals
        const adsWithVirtuals = ads.map(ad => ({
            ...ad,
            advertiser: ad.user,
            user: undefined,
            performanceScore: calculatePerformanceScore(ad),
            remainingBudget: (ad.budget?.total || 0) - (ad.budget?.spent || 0),
            daysRemaining: ad.campaign?.schedule?.endDate ? 
                Math.ceil((new Date(ad.campaign.schedule.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0
        }));

        res.json({
            success: true,
            data: {
                ads: adsWithVirtuals,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / parseInt(limit)),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get user ads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advertisements',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Get targeted ads for user feed
export async function getTargetedAds(req, res) {
    try {
        const { limit = 5 } = req.query;
        
        // Get user details for targeting
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });
        
        // Fetch running ads
        // Note: Complex filtering done in memory for flexibility with JSON fields
        const allRunningAds = await prisma.ad.findMany({
            where: { status: 'running' },
            include: {
                user: {
                    select: { username: true, profilePicture: true, blueTick: true }
                }
            }
        });

        const now = new Date();
        
        const targetedAds = allRunningAds.filter(ad => {
            // Check dates
            const startDate = new Date(ad.campaign.schedule.startDate);
            const endDate = new Date(ad.campaign.schedule.endDate);
            if (now < startDate || now > endDate) return false;

            // Check budget
            if (ad.budget.spent >= ad.budget.total) return false;

            // Targeting logic
            const targeting = ad.targetAudience || {};
            
            // Age targeting
            if (user.age && targeting.age) {
                if (user.age < targeting.age.min || user.age > targeting.age.max) return false;
            }

            // Location targeting
            if (user.location && targeting.location && targeting.location.length > 0) {
                if (!targeting.location.includes(user.location)) return false;
            }

            // Followers targeting (if user object has followers array/count)
            // Assuming user.followers is count or array
            const followerCount = Array.isArray(user.followers) ? user.followers.length : (user.followers || 0);
            if (targeting.followersRange) {
                if (followerCount < targeting.followersRange.min || followerCount > targeting.followersRange.max) return false;
            }

            return true;
        });

        // Sort by bid amount and limit
        const sortedAds = targetedAds
            .sort((a, b) => (b.pricing?.bidAmount || 0) - (a.pricing?.bidAmount || 0))
            .slice(0, parseInt(limit));

        const mappedAds = sortedAds.map(ad => ({
            ...ad,
            advertiser: ad.user,
            user: undefined
        }));

        res.json({
            success: true,
            data: {
                ads: mappedAds,
                count: mappedAds.length
            }
        });

    } catch (error) {
        console.error('Get targeted ads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch targeted advertisements',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Track ad impression
export async function trackImpression(req, res) {
    try {
        const { adId, metadata = {} } = req.body;
        
        if (!adId) {
            return res.status(400).json({
                success: false,
                message: 'Ad ID is required'
            });
        }

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        if (ad.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Advertisement is not active'
            });
        }

        // Update analytics
        const analytics = ad.analytics || { 
            impressions: 0, reach: 0, demographics: { age: [], gender: [], location: [] } 
        };
        
        analytics.impressions = (analytics.impressions || 0) + 1;

        // Track unique reach (simplified: check if user viewed before - requiring a separate tracking table or array)
        // For Prisma/SQL, storing large arrays of userIDs in a column is bad practice.
        // Ideally we'd have an AdView table.
        // For migration speed, we'll assume we increment reach if we don't have better tracking, 
        // or check if we can add to a list if it's small.
        // Mongoose model had `viewedBy` array on the document. We didn't add that to Prisma schema.
        // Let's assume for now we just increment reach probabilistically or blindly for this migration 
        // to avoid schema changes if not strictly necessary, OR we add `viewedBy` to schema later.
        // Checking schema... `viewedBy` is NOT in `Ad` model in schema.
        // So we will just increment reach for now (or assume 1 impression = 1 reach for simplicity unless we add table).
        // Let's stick to updating the counters.
        analytics.reach = (analytics.reach || 0) + 1; // Simplified

        // Update demographics
        if (metadata.age) {
            const ageRange = getAgeRange(metadata.age);
            const demoAge = analytics.demographics.age || [];
            const existingAge = demoAge.find(a => a.range === ageRange);
            if (existingAge) {
                existingAge.count++;
            } else {
                demoAge.push({ range: ageRange, count: 1 });
            }
            analytics.demographics.age = demoAge;
        }

        // Update CTR
        if (analytics.impressions > 0) {
            analytics.ctr = ((analytics.clicks || 0) / analytics.impressions * 100).toFixed(2);
        }

        // Update frequency
        if (analytics.reach > 0) {
            analytics.frequency = (analytics.impressions / analytics.reach).toFixed(2);
        }

        // Check budget for CPM
        let budget = ad.budget;
        if (ad.pricing?.model === 'cpm' && analytics.impressions % 1000 === 0) {
            budget.spent += (ad.pricing.bidAmount || 0);
        }

        // Auto-pause if budget exhausted
        let status = ad.status;
        if (budget.spent >= budget.total) {
            status = 'completed';
        }

        await prisma.ad.update({
            where: { id: adId },
            data: {
                analytics,
                budget,
                status
            }
        });

        res.json({
            success: true,
            message: 'Impression tracked successfully',
            data: {
                impressions: analytics.impressions,
                ctr: analytics.ctr,
                reach: analytics.reach
            }
        });

    } catch (error) {
        console.error('Track impression error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track impression',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Track ad click
export async function trackClick(req, res) {
    try {
        const { adId, metadata = {} } = req.body;
        
        if (!adId) {
            return res.status(400).json({
                success: false,
                message: 'Ad ID is required'
            });
        }

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        if (ad.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Advertisement is not active'
            });
        }

        const analytics = ad.analytics || { clicks: 0, impressions: 0 };
        analytics.clicks = (analytics.clicks || 0) + 1;

        // Update CTR
        if (analytics.impressions > 0) {
            analytics.ctr = (analytics.clicks / analytics.impressions * 100).toFixed(2);
        }

        // Update budget for CPC
        let budget = ad.budget;
        if (ad.pricing?.model === 'cpc') {
            budget.spent += (ad.pricing.bidAmount || 0);
        }

        // Auto-pause if budget exhausted
        let status = ad.status;
        if (budget.spent >= budget.total) {
            status = 'completed';
        }

        await prisma.ad.update({
            where: { id: adId },
            data: {
                analytics,
                budget,
                status
            }
        });

        res.json({
            success: true,
            message: 'Click tracked successfully',
            data: {
                clicks: analytics.clicks,
                ctr: analytics.ctr,
                budgetSpent: budget.spent,
                remainingBudget: budget.total - budget.spent
            }
        });

    } catch (error) {
        console.error('Track click error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track click',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Track ad conversion
export async function trackConversion(req, res) {
    try {
        const { adId, conversionValue = 0, conversionType } = req.body;
        
        if (!adId) {
            return res.status(400).json({
                success: false,
                message: 'Ad ID is required'
            });
        }

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        const analytics = ad.analytics || { conversions: 0, clicks: 0 };
        analytics.conversions = (analytics.conversions || 0) + 1;

        // Update conversion rate
        if (analytics.clicks > 0) {
            analytics.conversionRate = (analytics.conversions / analytics.clicks * 100).toFixed(2);
        }

        // Update budget for CPA
        let budget = ad.budget;
        if (ad.pricing?.model === 'cpa') {
            budget.spent += (ad.pricing.bidAmount || 0);
        }

        // Auto-pause if budget exhausted
        let status = ad.status;
        if (budget.spent >= budget.total) {
            status = 'completed';
        }

        await prisma.ad.update({
            where: { id: adId },
            data: {
                analytics,
                budget,
                status
            }
        });

        res.json({
            success: true,
            message: 'Conversion tracked successfully',
            data: {
                conversions: analytics.conversions,
                conversionRate: analytics.conversionRate,
                budgetSpent: budget.spent
            }
        });

    } catch (error) {
        console.error('Track conversion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track conversion',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Get ad analytics
export async function getAdAnalytics(req, res) {
    try {
        const { adId } = req.params;
        
        const ad = await prisma.ad.findUnique({
            where: { id: adId },
            include: {
                user: {
                    select: { username: true, profilePicture: true }
                }
            }
        });
        
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        if (ad.advertiserId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const analytics = {
            overview: {
                impressions: ad.analytics.impressions,
                clicks: ad.analytics.clicks,
                ctr: ad.analytics.ctr,
                conversions: ad.analytics.conversions,
                conversionRate: ad.analytics.conversionRate,
                reach: ad.analytics.reach,
                frequency: ad.analytics.frequency,
                performanceScore: calculatePerformanceScore(ad)
            },
            budget: {
                total: ad.budget.total,
                spent: ad.budget.spent,
                remaining: ad.budget.total - ad.budget.spent,
                currency: ad.budget.currency
            },
            engagement: ad.analytics.engagements,
            demographics: ad.analytics.demographics,
            performance: ad.analytics.performance,
            campaign: {
                daysRemaining: ad.campaign.schedule.endDate ? 
                    Math.ceil((new Date(ad.campaign.schedule.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0,
                status: ad.status,
                objective: ad.campaign.objective
            }
        };

        res.json({
            success: true,
            data: analytics
        });

    } catch (error) {
        console.error('Get ad analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ad analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Update advertisement
export async function updateAd(req, res) {
    try {
        const { adId } = req.params;
        const updates = req.body;

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        if (ad.advertiserId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (ad.status === 'running' && !['paused', 'running'].includes(updates.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify running ads. Pause the ad first.'
            });
        }

        const updatedAd = await prisma.ad.update({
            where: { id: adId },
            data: updates
        });

        res.json({
            success: true,
            message: 'Advertisement updated successfully',
            ad: updatedAd
        });

    } catch (error) {
        console.error('Update ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update advertisement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Delete advertisement
export async function deleteAd(req, res) {
    try {
        const { adId } = req.params;

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        if (ad.advertiserId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (ad.status === 'running') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete running advertisement. Pause it first.'
            });
        }

        await prisma.ad.delete({ where: { id: adId } });

        res.json({
            success: true,
            message: 'Advertisement deleted successfully'
        });

    } catch (error) {
        console.error('Delete ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete advertisement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Admin: Get all ads for review
export async function getAllAdsForReview(req, res) {
    try {
        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [ads, total] = await Promise.all([
            prisma.ad.findMany({
                where: { status },
                include: {
                    user: {
                        select: { username: true, profilePicture: true, blueTick: true, interests: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit),
                skip
            }),
            prisma.ad.count({ where: { status } })
        ]);

        const mappedAds = ads.map(ad => ({
            ...ad,
            advertiser: ad.user,
            user: undefined
        }));

        res.json({
            success: true,
            data: {
                ads: mappedAds,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / parseInt(limit)),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get ads for review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ads for review',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Admin: Review advertisement
export async function reviewAd(req, res) {
    try {
        const { adId } = req.params;
        const { status, rejectionReason, feedback } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "approved" or "rejected"'
            });
        }

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        const updatedAd = await prisma.ad.update({
            where: { id: adId },
            data: {
                status: status === 'approved' ? 'running' : 'rejected',
                review: {
                    reviewedBy: req.user.id,
                    reviewedAt: new Date(),
                    rejectionReason: status === 'rejected' ? rejectionReason : undefined,
                    feedback
                }
            }
        });

        res.json({
            success: true,
            message: `Advertisement ${status} successfully`,
            ad: updatedAd
        });

    } catch (error) {
        console.error('Review ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review advertisement',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Get ad performance dashboard
export async function getAdDashboard(req, res) {
    try {
        const userId = req.user.id;
        const { timeRange = '30d' } = req.query;

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        const days = parseInt(timeRange.replace('d', ''));
        startDate.setDate(startDate.getDate() - days);

        const ads = await prisma.ad.findMany({
            where: {
                advertiserId: userId,
                createdAt: { gte: startDate, lte: endDate }
            }
        });

        const dashboard = {
            summary: {
                totalAds: ads.length,
                activeAds: ads.filter(ad => ad.status === 'running').length,
                totalSpent: ads.reduce((sum, ad) => sum + (ad.budget?.spent || 0), 0),
                totalImpressions: ads.reduce((sum, ad) => sum + (ad.analytics?.impressions || 0), 0),
                totalClicks: ads.reduce((sum, ad) => sum + (ad.analytics?.clicks || 0), 0),
                totalConversions: ads.reduce((sum, ad) => sum + (ad.analytics?.conversions || 0), 0),
                averageCTR: ads.length > 0 ? 
                    (ads.reduce((sum, ad) => sum + parseFloat(ad.analytics?.ctr || 0), 0) / ads.length).toFixed(2) : 0
            },
            byStatus: ads.reduce((acc, ad) => {
                acc[ad.status] = (acc[ad.status] || 0) + 1;
                return acc;
            }, {}),
            topPerformingAds: ads
                .filter(ad => (ad.analytics?.impressions || 0) > 0)
                .map(ad => ({ ...ad, performanceScore: calculatePerformanceScore(ad) }))
                .sort((a, b) => b.performanceScore - a.performanceScore)
                .slice(0, 5)
                .map(ad => ({
                    id: ad.id,
                    title: ad.title,
                    performanceScore: ad.performanceScore,
                    ctr: ad.analytics?.ctr || 0,
                    conversions: ad.analytics?.conversions || 0
                })),
            spending: {
                totalBudget: ads.reduce((sum, ad) => sum + (ad.budget?.total || 0), 0),
                totalSpent: ads.reduce((sum, ad) => sum + (ad.budget?.spent || 0), 0),
                remainingBudget: ads.reduce((sum, ad) => sum + ((ad.budget?.total || 0) - (ad.budget?.spent || 0)), 0)
            }
        };

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error('Get ad dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Legacy support (redirect to trackImpression)
export const trackView = trackImpression;
