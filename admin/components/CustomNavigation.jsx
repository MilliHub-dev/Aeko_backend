import React from 'react';
import { Box, Button, Text } from '@adminjs/design-system';
import styled from 'styled-components';

const NavContainer = styled(Box)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Logo = styled(Box)`
  display: flex;
  align-items: center;
  font-size: 24px;
  font-weight: bold;
`;

const LogoIcon = styled.div`
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 20px;
`;

const UserInfo = styled(Box)`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const LogoutButton = styled(Button)`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
`;

const CustomNavigation = () => {
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  };

  return (
    <NavContainer>
      <Logo>
        <LogoIcon>A</LogoIcon>
        <Text color="white" fontSize="xl" fontWeight="bold">
          Aeko Admin
        </Text>
      </Logo>
      
      <UserInfo>
        <Text color="white" opacity={0.9}>
          Welcome, Administrator
        </Text>
        <LogoutButton onClick={handleLogout}>
          🚪 Logout
        </LogoutButton>
      </UserInfo>
    </NavContainer>
  );
};

export default CustomNavigation;
