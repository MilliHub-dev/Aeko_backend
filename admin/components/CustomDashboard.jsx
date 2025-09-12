import React from 'react';
import { Box, H1, H2, Text, Button, Badge } from '@adminjs/design-system';
import styled from 'styled-components';

const DashboardContainer = styled(Box)`
  padding: 30px;
  background: #f8fafc;
  min-height: 100vh;
`;

const Header = styled(Box)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 15px;
  padding: 30px;
  color: white;
  margin-bottom: 30px;
  position: relative;
  overflow: hidden;
`;

const HeaderContent = styled(Box)`
  position: relative;
  z-index: 2;
`;

const StatsGrid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled(Box)`
  background: white;
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }
`;

const StatNumber = styled(Text)`
  font-size: 32px;
  font-weight: bold;
  color: #2d3748;
  margin-bottom: 5px;
`;

const StatLabel = styled(Text)`
  color: #718096;
  font-size: 14px;
  font-weight: 500;
`;

const QuickActions = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
`;

const ActionButton = styled(Button)`
  padding: 15px 20px;
  border-radius: 10px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-1px);
  }
`;

const RecentActivity = styled(Box)`
  background: white;
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
`;

const ActivityItem = styled(Box)`
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #e2e8f0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const ActivityIcon = styled(Box)`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 18px;
`;

const LogoutButton = styled(Button)`
  position: absolute;
  top: 20px;
  right: 20px;
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

const CustomDashboard = () => {
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  };

  return (
    <DashboardContainer>
      <Header>
        <LogoutButton onClick={handleLogout}>
          🚪 Logout
        </LogoutButton>
        <HeaderContent>
          <H1 marginBottom="sm">Welcome to Aeko Admin</H1>
          <Text fontSize="lg" opacity={0.9}>
            Manage your social media platform with powerful admin tools
          </Text>
        </HeaderContent>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatNumber>1,247</StatNumber>
          <StatLabel>Total Users</StatLabel>
          <Badge variant="success" marginTop="sm">+12% this week</Badge>
        </StatCard>
        
        <StatCard>
          <StatNumber>89</StatNumber>
          <StatLabel>Active Streams</StatLabel>
          <Badge variant="info" marginTop="sm">Live now</Badge>
        </StatCard>
        
        <StatCard>
          <StatNumber>3,456</StatNumber>
          <StatLabel>Posts Today</StatLabel>
          <Badge variant="primary" marginTop="sm">+5% vs yesterday</Badge>
        </StatCard>
        
        <StatCard>
          <StatNumber>23</StatNumber>
          <StatLabel>Pending Reports</StatLabel>
          <Badge variant="danger" marginTop="sm">Needs attention</Badge>
        </StatCard>
      </StatsGrid>

      <H2 marginBottom="lg">Quick Actions</H2>
      <QuickActions>
        <ActionButton variant="primary">
          👥 Manage Users
        </ActionButton>
        <ActionButton variant="success">
          📊 View Analytics
        </ActionButton>
        <ActionButton variant="info">
          🤖 AI Bot Settings
        </ActionButton>
        <ActionButton variant="warning">
          🚨 Review Reports
        </ActionButton>
        <ActionButton variant="secondary">
          💰 Payment Overview
        </ActionButton>
        <ActionButton variant="primary">
          🎥 Stream Management
        </ActionButton>
      </QuickActions>

      <RecentActivity>
        <H2 marginBottom="lg">Recent Activity</H2>
        
        <ActivityItem>
          <ActivityIcon style={{ background: '#e3f2fd', color: '#1976d2' }}>
            👤
          </ActivityIcon>
          <Box>
            <Text fontWeight="bold">New user registered</Text>
            <Text fontSize="sm" color="grey60">john_doe joined the platform • 2 minutes ago</Text>
          </Box>
        </ActivityItem>

        <ActivityItem>
          <ActivityIcon style={{ background: '#fff3e0', color: '#f57c00' }}>
            🚨
          </ActivityIcon>
          <Box>
            <Text fontWeight="bold">Content reported</Text>
            <Text fontSize="sm" color="grey60">Inappropriate content flagged by user • 15 minutes ago</Text>
          </Box>
        </ActivityItem>

        <ActivityItem>
          <ActivityIcon style={{ background: '#e8f5e8', color: '#388e3c' }}>
            💰
          </ActivityIcon>
          <Box>
            <Text fontWeight="bold">Payment processed</Text>
            <Text fontSize="sm" color="grey60">Premium subscription activated • 1 hour ago</Text>
          </Box>
        </ActivityItem>

        <ActivityItem>
          <ActivityIcon style={{ background: '#fce4ec', color: '#c2185b' }}>
            🎥
          </ActivityIcon>
          <Box>
            <Text fontWeight="bold">Live stream started</Text>
            <Text fontSize="sm" color="grey60">@streamer_pro went live with 234 viewers • 2 hours ago</Text>
          </Box>
        </ActivityItem>
      </RecentActivity>
    </DashboardContainer>
  );
};

export default CustomDashboard;
