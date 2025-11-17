import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  Text,
  useToast,
  Spinner,
  Heading,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

const PaymentForm = ({ community, onSuccess }) => {
  const [amount, setAmount] = useState(community?.settings?.payment?.price || 0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const { communityId } = useParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`/api/community/payment/initialize`, {
        communityId,
        paymentMethod,
      });

      if (response.data.authorizationUrl) {
        // Redirect to payment gateway
        window.location.href = response.data.authorizationUrl;
      } else if (response.data.success && onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError(err.response?.data?.message || 'Failed to initialize payment');
      toast({
        title: 'Payment Error',
        description: err.response?.data?.message || 'Failed to process payment',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If community data is passed, set the default amount
    if (community?.settings?.payment?.price) {
      setAmount(community.settings.payment.price);
    }
  }, [community]);

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg" boxShadow="md">
      <Heading as="h2" size="lg" mb={6}>
        Complete Your Payment
      </Heading>
      
      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>Amount</FormLabel>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              isDisabled={!!community?.settings?.payment?.price}
            />
            {community?.settings?.payment?.subscriptionType && (
              <Text fontSize="sm" color="gray.500" mt={1}>
                {community.settings.payment.subscriptionType === 'one_time' 
                  ? 'One-time payment' 
                  : `Recurring ${community.settings.payment.subscriptionType} payment`}
              </Text>
            )}
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Payment Method</FormLabel>
            <Select
              placeholder="Select payment method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {community?.settings?.payment?.paymentMethods?.map((method) => (
                <option key={method} value={method}>
                  {method === 'aeko_wallet' ? 'Aeko Wallet' 
                   : method === 'paystack' ? 'Paystack' 
                   : method === 'stripe' ? 'Stripe' 
                   : method}
                </option>
              ))}
            </Select>
          </FormControl>

          <Button
            type="submit"
            colorScheme="blue"
            size="lg"
            width="full"
            isLoading={isLoading}
            loadingText="Processing..."
            isDisabled={!paymentMethod || !amount}
          >
            Pay {amount} {community?.settings?.payment?.currency || 'USD'}
          </Button>
        </VStack>
      </form>
    </Box>
  );
};

export default PaymentForm;
