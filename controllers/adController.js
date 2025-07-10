import Ad from '../models/Ad.js';
import User from '../models/User.js';

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

        const newAd = new Ad({
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
            placement,
            advertiserId: req.user.id,
            status: 'pending'
        });

        await newAd.save();

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
            error: error.message
        });
    }
}

// Get user's advertisements
export async function getUserAds(req, res) {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        const query = { advertiserId: req.user.id };
        if (status) {
            query.status = status;
        }

        const ads = await Ad.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('advertiserId', 'username profilePicture blueTick');

        const total = await Ad.countDocuments(query);

        res.json({
            success: true,
            data: {
                ads,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get user ads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch advertisements',
            error: error.message
        });
    }
}

// Get targeted ads for user feed
export async function getTargetedAds(req, res) {
    try {
        const { limit = 5 } = req.query;
        const user = await User.findById(req.user.id);
        
        const ads = await Ad.getTargetedAds(user, parseInt(limit));

        res.json({
            success: true,
            data: {
                ads,
                count: ads.length
            }
        });

    } catch (error) {
        console.error('Get targeted ads error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch targeted advertisements',
            error: error.message
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

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        // Check if ad is active
        if (ad.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Advertisement is not active'
            });
        }

        await ad.recordImpression(req.user.id, metadata);

        // Update budget for CPM model
        if (ad.pricing.model === 'cpm' && ad.analytics.impressions % 1000 === 0) {
            ad.budget.spent += ad.pricing.bidAmount;
            await ad.save();
        }

        res.json({
            success: true,
            message: 'Impression tracked successfully',
            data: {
                impressions: ad.analytics.impressions,
                ctr: ad.analytics.ctr,
                reach: ad.analytics.reach
            }
        });

    } catch (error) {
        console.error('Track impression error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track impression',
            error: error.message
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

        const ad = await Ad.findById(adId);
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

        await ad.recordClick(req.user.id, metadata);

        res.json({
            success: true,
            message: 'Click tracked successfully',
            data: {
                clicks: ad.analytics.clicks,
                ctr: ad.analytics.ctr,
                budgetSpent: ad.budget.spent,
                remainingBudget: ad.remainingBudget
            }
        });

    } catch (error) {
        console.error('Track click error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track click',
            error: error.message
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

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        await ad.recordConversion(req.user.id, conversionValue);

        res.json({
            success: true,
            message: 'Conversion tracked successfully',
            data: {
                conversions: ad.analytics.conversions,
                conversionRate: ad.analytics.conversionRate,
                budgetSpent: ad.budget.spent
            }
        });

    } catch (error) {
        console.error('Track conversion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track conversion',
            error: error.message
        });
    }
}

// Get ad analytics
export async function getAdAnalytics(req, res) {
    try {
        const { adId } = req.params;
        const { timeRange = '7d' } = req.query;

        const ad = await Ad.findById(adId).populate('advertiserId', 'username profilePicture');
        
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        // Check if user owns the ad
        if (ad.advertiserId._id.toString() !== req.user.id) {
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
                performanceScore: ad.performanceScore
            },
            budget: {
                total: ad.budget.total,
                spent: ad.budget.spent,
                remaining: ad.remainingBudget,
                currency: ad.budget.currency
            },
            engagement: ad.analytics.engagements,
            demographics: ad.analytics.demographics,
            performance: ad.analytics.performance,
            campaign: {
                daysRemaining: ad.daysRemaining,
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
            error: error.message
        });
    }
}

// Update advertisement
export async function updateAd(req, res) {
    try {
        const { adId } = req.params;
        const updates = req.body;

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        // Check if user owns the ad
        if (ad.advertiserId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Prevent updates to running ads (only allow pause/unpause)
        if (ad.status === 'running' && !['paused', 'running'].includes(updates.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify running ads. Pause the ad first.'
            });
        }

        Object.assign(ad, updates);
        await ad.save();

        res.json({
            success: true,
            message: 'Advertisement updated successfully',
            ad
        });

    } catch (error) {
        console.error('Update ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update advertisement',
            error: error.message
        });
    }
}

// Delete advertisement
export async function deleteAd(req, res) {
    try {
        const { adId } = req.params;

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        // Check if user owns the ad
        if (ad.advertiserId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Prevent deletion of running ads
        if (ad.status === 'running') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete running advertisement. Pause it first.'
            });
        }

        await Ad.findByIdAndDelete(adId);

        res.json({
            success: true,
            message: 'Advertisement deleted successfully'
        });

    } catch (error) {
        console.error('Delete ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete advertisement',
            error: error.message
        });
    }
}

// Admin: Get all ads for review
export async function getAllAdsForReview(req, res) {
    try {
        const { status = 'pending', page = 1, limit = 20 } = req.query;

        const query = { status };
        const ads = await Ad.find(query)
            .populate('advertiserId', 'username profilePicture blueTick')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Ad.countDocuments(query);

        res.json({
            success: true,
            data: {
                ads,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get ads for review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ads for review',
            error: error.message
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

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'Advertisement not found'
            });
        }

        ad.status = status === 'approved' ? 'running' : 'rejected';
        ad.review = {
            reviewedBy: req.user.id,
            reviewedAt: new Date(),
            rejectionReason: status === 'rejected' ? rejectionReason : undefined,
            feedback
        };

        await ad.save();

        // TODO: Send notification to advertiser
        // await notificationService.sendAdReviewNotification(ad.advertiserId, ad);

        res.json({
            success: true,
            message: `Advertisement ${status} successfully`,
            ad
        });

    } catch (error) {
        console.error('Review ad error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review advertisement',
            error: error.message
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

        const ads = await Ad.find({
            advertiserId: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });

        const dashboard = {
            summary: {
                totalAds: ads.length,
                activeAds: ads.filter(ad => ad.status === 'running').length,
                totalSpent: ads.reduce((sum, ad) => sum + ad.budget.spent, 0),
                totalImpressions: ads.reduce((sum, ad) => sum + ad.analytics.impressions, 0),
                totalClicks: ads.reduce((sum, ad) => sum + ad.analytics.clicks, 0),
                totalConversions: ads.reduce((sum, ad) => sum + ad.analytics.conversions, 0),
                averageCTR: ads.length > 0 ? 
                    (ads.reduce((sum, ad) => sum + parseFloat(ad.analytics.ctr), 0) / ads.length).toFixed(2) : 0
            },
            byStatus: ads.reduce((acc, ad) => {
                acc[ad.status] = (acc[ad.status] || 0) + 1;
                return acc;
            }, {}),
            topPerformingAds: ads
                .filter(ad => ad.analytics.impressions > 0)
                .sort((a, b) => b.performanceScore - a.performanceScore)
                .slice(0, 5)
                .map(ad => ({
                    id: ad._id,
                    title: ad.title,
                    performanceScore: ad.performanceScore,
                    ctr: ad.analytics.ctr,
                    conversions: ad.analytics.conversions
                })),
            spending: {
                totalBudget: ads.reduce((sum, ad) => sum + ad.budget.total, 0),
                totalSpent: ads.reduce((sum, ad) => sum + ad.budget.spent, 0),
                remainingBudget: ads.reduce((sum, ad) => sum + ad.remainingBudget, 0)
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
            message: 'Failed to fetch ad dashboard',
            error: error.message
        });
    }
}

// Legacy functions for backward compatibility
export async function trackView(req, res) {
    return trackImpression(req, res);
}
