import React from 'react';
import {
  Box,
  SimpleGrid,
  Text,
  VStack,
  Icon,
  useColorModeValue,
  Tooltip,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { FaCreditCard, FaWallet, FaMoneyBillWave } from 'react-icons/fa';

const PaymentMethods = ({ methods = [], onSelect, selectedMethod }) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const getMethodIcon = (method) => {
    switch (method) {
      case 'aeko_wallet':
        return <Icon as={FaWallet} boxSize={6} color="blue.500" />;
      case 'stripe':
        return <Icon as={FaCreditCard} boxSize={6} color="purple.500" />;
      case 'paystack':
        return <Icon as={FaMoneyBillWave} boxSize={6} color="green.500" />;
      default:
        return <Icon as={FaCreditCard} boxSize={6} />;
    }
  };

  const getMethodName = (method) => {
    switch (method) {
      case 'aeko_wallet':
        return 'Aeko Wallet';
      case 'stripe':
        return 'Credit/Debit Card (Stripe)';
      case 'paystack':
        return 'Paystack';
      default:
        return method;
    }
  };

  const getMethodDescription = (method) => {
    switch (method) {
      case 'aeko_wallet':
        return 'Pay directly from your Aeko wallet balance';
      case 'stripe':
        return 'Pay with any major credit or debit card';
      case 'paystack':
        return 'Pay with Paystack (supports bank transfers, USSD, etc.)';
      default:
        return 'Select this payment method';
    }
  };

  if (methods.length === 0) {
    return (
      <Box p={4} textAlign="center">
        <Text color="gray.500">No payment methods available</Text>
      </Box>
    );
  }

  return (
    <SimpleGrid columns={[1, 2, 3]} spacing={4} w="100%">
      {methods.map((method) => (
        <Box
          key={method}
          p={4}
          borderWidth="1px"
          borderRadius="lg"
          bg={cardBg}
          borderColor={selectedMethod === method ? 'blue.500' : borderColor}
          cursor="pointer"
          onClick={() => onSelect(method)}
          _hover={{
            borderColor: 'blue.300',
            boxShadow: 'md',
            transform: 'translateY(-2px)',
          }}
          transition="all 0.2s"
          position="relative"
        >
          {selectedMethod === method && (
            <Badge colorScheme="blue" position="absolute" top={2} right={2}>
              Selected
            </Badge>
          )}
          <VStack spacing={3} align="flex-start">
            <HStack>
              {getMethodIcon(method)}
              <Text fontWeight="bold">{getMethodName(method)}</Text>
            </HStack>
            <Text fontSize="sm" color="gray.500">
              {getMethodDescription(method)}
            </Text>
          </VStack>
        </Box>
      ))}
    </SimpleGrid>
  );
};

export default PaymentMethods;
