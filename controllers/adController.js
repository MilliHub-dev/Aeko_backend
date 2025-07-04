import Ad from '../models/Ad.js';

export async function trackView(req, res) {
    try {
        const { ad_id } = req.body;
        const ad = await Ad.findOneAndUpdate(
            { ad_id },
            { $inc: { views: 1 } },
            { new: true, upsert: true }
        );
        res.json({ message: "View tracked", ad });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error tracking view" });
    }
}

export async function trackClick(req, res) {
    try {
        const { ad_id } = req.body;
        const ad = await Ad.findOneAndUpdate(
            { ad_id },
            { $inc: { clicks: 1 } },
            { new: true, upsert: true }
        );

        // Update CTR (Click-Through Rate)
        ad.ctr = ((ad.clicks / ad.views) * 100).toFixed(2);
        await ad.save();

        res.json({ message: "Click tracked", ad });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error tracking click" });
    }
}
