import React, { useState } from 'react';
import { Box, Button, Input, Label, Text, H1, MessageBox } from '@adminjs/design-system';
import styled from 'styled-components';

const LoginContainer = styled(Box)`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const LoginCard = styled(Box)`
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 60px 40px;
  width: 100%;
  max-width: 450px;
  text-align: center;
`;

const LogoContainer = styled(Box)`
  margin-bottom: 40px;
`;

const Logo = styled.div`
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 20px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  color: white;
`;

const StyledInput = styled(Input)`
  margin-bottom: 20px;
  padding: 15px;
  border-radius: 10px;
  border: 2px solid #e1e5e9;
  font-size: 16px;
  transition: all 0.3s ease;
  
  &:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const LoginButton = styled(Button)`
  width: 100%;
  padding: 15px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  font-size: 16px;
  font-weight: 600;
  margin-top: 10px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
  }
`;

const FeatureList = styled(Box)`
  margin-top: 30px;
  text-align: left;
`;

const FeatureItem = styled(Box)`
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  font-size: 14px;
  color: #666;
`;

const CheckIcon = styled.span`
  color: #4CAF50;
  margin-right: 10px;
  font-weight: bold;
`;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token and redirect
        localStorage.setItem('adminToken', data.token);
        window.location.href = '/admin/resources/User';
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer>
      <LoginCard>
        <LogoContainer>
          <Logo>A</Logo>
          <H1 color="grey80">Aeko Admin</H1>
          <Text color="grey60">Platform Management Dashboard</Text>
        </LogoContainer>

        {error && (
          <MessageBox message={error} variant="danger" style={{ marginBottom: '20px' }} />
        )}

        <form onSubmit={handleLogin}>
          <Box marginBottom="lg">
            <Label htmlFor="email">Email Address</Label>
            <StyledInput
              id="email"
              type="email"
              placeholder="admin@aeko.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Box>

          <Box marginBottom="lg">
            <Label htmlFor="password">Password</Label>
            <StyledInput
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Box>

          <LoginButton type="submit" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In to Dashboard'}
          </LoginButton>
        </form>

        <FeatureList>
          <Text fontSize="sm" fontWeight="bold" color="grey80" marginBottom="md">
            Admin Features:
          </Text>
          <FeatureItem>
            <CheckIcon>✓</CheckIcon>
            User Management & Moderation
          </FeatureItem>
          <FeatureItem>
            <CheckIcon>✓</CheckIcon>
            Content & Stream Control
          </FeatureItem>
          <FeatureItem>
            <CheckIcon>✓</CheckIcon>
            Analytics & Reports
          </FeatureItem>
          <FeatureItem>
            <CheckIcon>✓</CheckIcon>
            AI Bot Management
          </FeatureItem>
          <FeatureItem>
            <CheckIcon>✓</CheckIcon>
            Blockchain & NFT Oversight
          </FeatureItem>
        </FeatureList>

        <Box marginTop="xl">
          <Text fontSize="xs" color="grey40">
            Aeko Platform v2.0 • Secure Admin Access
          </Text>
        </Box>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginPage;
