import Flutterwave from 'flutterwave-node-v3';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Flutterwave only if keys are provided
let flw = null;
if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
    flw = new Flutterwave(process.env.FLUTTERWAVE_PUBLIC_KEY, process.env.FLUTTERWAVE_SECRET_KEY);
}

export async function initiatePayment(req, res) {
    try {
        if (!flw) {
            return res.status(500).json({ error: "Payment service not configured" });
        }

        const { amount, email, phone, name } = req.body;

        const payload = {
            tx_ref: `tx-${Date.now()}`,
            amount,
            currency: "NGN",
            redirect_url: "https://your-site.com/payment-success",
            payment_options: "card, banktransfer, ussd",
            customer: {
                email,
                phonenumber: phone,
                name
            }
        };

        const response = await flw.PaymentInitiate(payload);
        return res.json(response);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Payment initiation failed" });
    }
}

export async function verifyPayment(req, res) {
    try {
        if (!flw) {
            return res.status(500).json({ error: "Payment service not configured" });
        }

        const { transaction_id } = req.query;
        const response = await flw.Transaction.verify({ id: transaction_id });

        if (response.status === "successful") {
            return res.json({ message: "Payment successful", data: response });
        }
        return res.status(400).json({ error: "Payment verification failed" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error verifying payment" });
    }
}
