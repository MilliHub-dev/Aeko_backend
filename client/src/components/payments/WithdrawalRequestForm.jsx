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
  AlertDescription,
  FormHelperText,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import axios from 'axios';

const WithdrawalRequestForm = ({ community, onSuccess, onCancel }) => {
  const [amount, setAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState('aeko_wallet');
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    bankCode: '',
    accountName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableBalance, setAvailableBalance] = useState(0);
  const toast = useToast();

  useEffect(() => {
    if (community?.settings?.payment?.availableForWithdrawal) {
      setAvailableBalance(community.settings.payment.availableForWithdrawal);
    }
  }, [community]);

  const handleBankDetailChange = (field, value) => {
    setBankDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (parseFloat(amount) > availableBalance) {
      setError('Amount exceeds available balance');
      return false;
    }

    if (withdrawalMethod === 'bank' && (!bankDetails.accountNumber || !bankDetails.bankCode || !bankDetails.accountName)) {
      setError('Please provide all required bank details');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const payload = {
        communityId: community._id,
        amount: parseFloat(amount),
        method: withdrawalMethod,
        details: withdrawalMethod === 'bank' ? bankDetails : {}
      };

      const response = await axios.post('/api/community/payment/withdraw', payload);
      
      toast({
        title: 'Withdrawal Requested',
        description: 'Your withdrawal request has been submitted successfully.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError(err.response?.data?.message || 'Failed to process withdrawal request');
      toast({
        title: 'Withdrawal Error',
        description: err.response?.data?.message || 'Failed to process withdrawal',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={6} borderWidth="1px" borderRadius="lg" boxShadow="md">
      <Heading as="h2" size="lg" mb={6}>
        Request Withdrawal
      </Heading>
      
      <Text mb={4} fontSize="lg">
        Available Balance: <Text as="span" fontWeight="bold" color="green.500">
          {availableBalance.toLocaleString()} {community?.settings?.payment?.currency || 'USD'}
        </Text>
      </Text>

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
            <FormLabel>Amount to Withdraw</FormLabel>
            <NumberInput
              min={1}
              max={availableBalance}
              value={amount}
              onChange={(valueString) => setAmount(valueString)}
            >
              <NumberInputField placeholder="Enter amount" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <FormHelperText>
              Minimum withdrawal: 1 {community?.settings?.payment?.currency || 'USD'}
            </FormHelperText>
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Withdrawal Method</FormLabel>
            <Select
              value={withdrawalMethod}
              onChange={(e) => setWithdrawalMethod(e.target.value)}
            >
              <option value="aeko_wallet">Aeko Wallet</option>
              <option value="bank">Bank Transfer</option>
            </Select>
          </FormControl>

          {withdrawalMethod === 'bank' && (
            <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50" _dark={{ bg: 'gray.700' }}>
              <Text fontWeight="bold" mb={3}>Bank Details</Text>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Account Number</FormLabel>
                  <Input
                    type="text"
                    value={bankDetails.accountNumber}
                    onChange={(e) => handleBankDetailChange('accountNumber', e.target.value)}
                    placeholder="Enter account number"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Bank Name</FormLabel>
                  <Select
                    placeholder="Select bank"
                    value={bankDetails.bankCode}
                    onChange={(e) => handleBankDetailChange('bankCode', e.target.value)}
                  >
                    <option value="044">Access Bank</option>
                    <option value="063">Diamond Bank</option>
                    <option value="050">Ecobank</option>
                    <option value="070">Fidelity Bank</option>
                    <option value="011">First Bank</option>
                    <option value="214">First City Monument Bank</option>
                    <option value="058">Guaranty Trust Bank</option>
                    <option value="030">Heritage Bank</option>
                    <option value="301">Jaiz Bank</option>
                    <option value="082">Keystone Bank</option>
                    <option value="076">Polaris Bank</option>
                    <option value="221">Stanbic IBTC Bank</option>
                    <option value="232">Sterling Bank</option>
                    <option value="032">Union Bank</option>
                    <option value="033">United Bank for Africa</option>
                    <option value="215">Unity Bank</option>
                    <option value="035">Wema Bank</option>
                    <option value="057">Zenith Bank</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Account Name</FormLabel>
                  <Input
                    type="text"
                    value={bankDetails.accountName}
                    onChange={(e) => handleBankDetailChange('accountName', e.target.value)}
                    placeholder="Enter account name"
                  />
                </FormControl>
              </VStack>
            </Box>
          )}

          <HStack spacing={4} mt={4} justifyContent="flex-end">
            <Button
              variant="outline"
              onClick={onCancel}
              isDisabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="green"
              isLoading={isLoading}
              loadingText="Processing..."
              isDisabled={!amount || parseFloat(amount) <= 0}
            >
              Request Withdrawal
            </Button>
          </HStack>
        </VStack>
      </form>
    </Box>
  );
};

export default WithdrawalRequestForm;
