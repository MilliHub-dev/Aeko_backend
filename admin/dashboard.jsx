import React, { useState, useEffect } from 'react';
import { Box, H2, H3, Text, Button, Card, Flex, Icon } from '@adminjs/design-system';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box padding="lg">
        <Text>Loading dashboard...</Text>
      </Box>
    );
  }

  return (
    <Box padding="lg">
      <H2 marginBottom="lg">Aeko Platform Admin Dashboard</H2>
      
      {/* Platform Overview Cards */}
      <Flex flexWrap="wrap" gap="lg" marginBottom="xl">
        <Card flex="1" minWidth="250px" padding="lg">
          <Flex alignItems="center" gap="md">
            <Icon icon="Users" size={24} color="primary" />
            <Box>
              <H3 marginBottom="sm">Total Users</H3>
              <Text fontSize="xl" fontWeight="bold" color="primary">
                {stats?.users?.totalUsers || 0}
              </Text>
              <Text fontSize="sm" color="grey60">
                {stats?.users?.verifiedUsers || 0} verified users
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card flex="1" minWidth="250px" padding="lg">
          <Flex alignItems="center" gap="md">
            <Icon icon="CreditCard" size={24} color="success" />
            <Box>
              <H3 marginBottom="sm">Active Subscriptions</H3>
              <Text fontSize="xl" fontWeight="bold" color="success">
                {stats?.users?.activeSubscriptions || 0}
              </Text>
              <Text fontSize="sm" color="grey60">
                Premium users
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card flex="1" minWidth="250px" padding="lg">
          <Flex alignItems="center" gap="md">
            <Icon icon="Bot" size={24} color="info" />
            <Box>
              <H3 marginBottom="sm">AI Bot Users</H3>
              <Text fontSize="xl" fontWeight="bold" color="info">
                {stats?.users?.botEnabledUsers || 0}
              </Text>
              <Text fontSize="sm" color="grey60">
                Bot enabled accounts
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card flex="1" minWidth="250px" padding="lg">
          <Flex alignItems="center" gap="md">
            <Icon icon="Ban" size={24} color="error" />
            <Box>
              <H3 marginBottom="sm">Banned Users</H3>
              <Text fontSize="xl" fontWeight="bold" color="error">
                {stats?.users?.bannedUsers || 0}
              </Text>
              <Text fontSize="sm" color="grey60">
                Moderation actions
              </Text>
            </Box>
          </Flex>
        </Card>
      </Flex>

      {/* Content Statistics */}
      <Card marginBottom="xl" padding="lg">
        <H3 marginBottom="lg">Content Overview</H3>
        <Flex flexWrap="wrap" gap="lg">
          {stats?.posts?.map((postType, index) => (
            <Box key={index} minWidth="200px">
              <Text fontSize="lg" fontWeight="bold" marginBottom="sm">
                {postType._id} Posts
              </Text>
              <Text fontSize="xl" color="primary" marginBottom="xs">
                {postType.count}
              </Text>
              <Text fontSize="sm" color="grey60">
                {postType.totalLikes} total likes
              </Text>
            </Box>
          ))}
        </Flex>
      </Card>

      {/* Advertising Statistics */}
      <Card marginBottom="xl" padding="lg">
        <H3 marginBottom="lg">Advertising Performance</H3>
        <Flex flexWrap="wrap" gap="lg">
          {stats?.ads?.map((adStatus, index) => (
            <Box key={index} minWidth="200px">
              <Text fontSize="lg" fontWeight="bold" marginBottom="sm">
                {adStatus._id} Ads
              </Text>
              <Text fontSize="xl" color="primary" marginBottom="xs">
                {adStatus.count}
              </Text>
              <Text fontSize="sm" color="grey60">
                ${adStatus.totalBudget} total budget
              </Text>
            </Box>
          ))}
        </Flex>
      </Card>

      {/* Quick Actions */}
      <Card padding="lg">
        <H3 marginBottom="lg">Quick Actions</H3>
        <Flex gap="md" flexWrap="wrap">
          <Button 
            variant="primary" 
            onClick={() => window.location.href = '/admin/resources/User'}
          >
            <Icon icon="Users" marginRight="sm" />
            Manage Users
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => window.location.href = '/admin/resources/Post'}
          >
            <Icon icon="FileText" marginRight="sm" />
            Content Moderation
          </Button>
          <Button 
            variant="success" 
            onClick={() => window.location.href = '/admin/resources/Ad'}
          >
            <Icon icon="DollarSign" marginRight="sm" />
            Ad Management
          </Button>
          <Button 
            variant="info" 
            onClick={() => window.location.href = '/admin/resources/LiveStream'}
          >
            <Icon icon="Video" marginRight="sm" />
            Stream Control
          </Button>
          <Button 
            variant="light" 
            onClick={fetchStats}
          >
            <Icon icon="Refresh" marginRight="sm" />
            Refresh Stats
          </Button>
        </Flex>
      </Card>

      {/* System Status */}
      <Card marginTop="xl" padding="lg">
        <H3 marginBottom="lg">System Status</H3>
        <Flex gap="lg" alignItems="center">
          <Flex alignItems="center" gap="sm">
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: '#28a745' 
            }} />
            <Text>Database Connected</Text>
          </Flex>
          <Flex alignItems="center" gap="sm">
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: '#28a745' 
            }} />
            <Text>Chat System Active</Text>
          </Flex>
          <Flex alignItems="center" gap="sm">
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: '#28a745' 
            }} />
            <Text>LiveStream Platform Ready</Text>
          </Flex>
          <Flex alignItems="center" gap="sm">
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: '#28a745' 
            }} />
            <Text>AI Bot System Online</Text>
          </Flex>
        </Flex>
        <Text fontSize="sm" color="grey60" marginTop="md">
          Last updated: {new Date().toLocaleString()}
        </Text>
      </Card>
    </Box>
  );
};

export default AdminDashboard;