import React, { useEffect, useState } from "react";
import { Box, H2, H4, Text, Loader, MessageBox } from "@adminjs/design-system";
import { ApiClient } from "adminjs";
// AdminJS re-exports its own helpers but not the router hooks; `useNavigate`
// belongs to react-router-dom, which AdminJS already mounts the panel inside.
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * Aeko admin overview.
 *
 * Replaces the stock AdminJS landing page, which was a marketing panel of links
 * to the AdminJS docs — no information about this platform at all.
 *
 * Every figure comes from the `dashboard.handler` in admin.js. That handler
 * settles each query independently, so a card whose query failed renders as "—"
 * with a notice rather than taking the page down.
 */

const TEAL = "#00BFA5";
const TEAL_DARK = "#003D3D";
const LIME = "#99FF00";
const BORDER = "#DCE7E7";
const MUTED = "#5E7A7A";

const Page = styled(Box)`
  padding: 24px;
  background: #f7fafa;
  min-height: 100%;
`;

const Hero = styled(Box)`
  border-radius: 16px;
  padding: 28px 32px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, ${TEAL_DARK} 0%, #005B57 55%, ${TEAL} 100%);
  color: #fff;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const LivePill = styled(Box)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 14px;
  font-weight: 600;
`;

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(props) => (props.$on ? LIME : "rgba(255,255,255,0.5)")};
  box-shadow: ${(props) => (props.$on ? `0 0 0 4px rgba(153,255,0,0.22)` : "none")};
`;

const Grid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const Card = styled(Box)`
  background: #fff;
  border: 1px solid ${BORDER};
  border-radius: 14px;
  padding: 20px;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    ${(props) =>
      props.$clickable
        ? `border-color: ${TEAL};
           box-shadow: 0 6px 20px rgba(0, 61, 61, 0.08);
           transform: translateY(-2px);`
        : ""}
  }
`;

const CardLabel = styled(Text)`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${MUTED};
  margin-bottom: 10px;
`;

const CardValue = styled(Text)`
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: ${TEAL_DARK};
`;

const Delta = styled(Text)`
  font-size: 13px;
  margin-top: 6px;
  color: ${(props) => (props.$attention ? "#C2410C" : MUTED)};
  font-weight: ${(props) => (props.$attention ? 600 : 400)};
`;

const Panel = styled(Box)`
  background: #fff;
  border: 1px solid ${BORDER};
  border-radius: 14px;
  padding: 22px;
`;

const Columns = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
`;

const Row = styled(Box)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f5f5;

  &:last-child {
    border-bottom: none;
  }
`;

const Avatar = styled(Box)`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${TEAL_DARK};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  background-image: ${(props) => (props.$src ? `url(${props.$src})` : "none")};
  background-size: cover;
  background-position: center;
`;

const RowText = styled(Box)`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 0;
`;

const Bars = styled(Box)`
  display: flex;
  align-items: flex-end;
  gap: 5px;
  height: 92px;
  margin-top: 8px;
`;

const Bar = styled(Box)`
  flex: 1;
  min-width: 4px;
  border-radius: 4px 4px 0 0;
  background: ${(props) => (props.$empty ? "#E6F6F4" : TEAL)};
  height: ${(props) => props.$height}%;
`;

const nf = new Intl.NumberFormat();
const fmt = (value) => (value === null || value === undefined ? "—" : nf.format(value));

const initials = (name, username) =>
  (name || username || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const relativeTime = (iso) => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units = [
    [60, "m"],
    [3600, "h"],
    [86400, "d"],
  ];
  if (seconds < 3600) return `${Math.floor(seconds / units[0][0])}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / units[1][0])}h ago`;
  return `${Math.floor(seconds / units[2][0])}d ago`;
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    new ApiClient()
      .getDashboard()
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load dashboard data.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Page>
        <MessageBox variant="danger" message="Dashboard unavailable">
          {error}
        </MessageBox>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <Loader />
      </Page>
    );
  }

  const cards = [
    {
      label: "Users",
      value: data.users,
      note: data.usersThisWeek ? `+${fmt(data.usersThisWeek)} this week` : "No new signups this week",
      href: "/admin/resources/User",
    },
    {
      label: "Posts",
      value: data.posts,
      note: data.postsThisWeek ? `+${fmt(data.postsThisWeek)} this week` : "None this week",
      href: "/admin/resources/Post",
    },
    {
      label: "Communities",
      value: data.communities,
      href: "/admin/resources/Community",
    },
    {
      label: "Open reports",
      value: data.openReports,
      note: data.openReports > 0 ? "Needs review" : "All clear",
      attention: data.openReports > 0,
      href: "/admin/resources/Report",
    },
    {
      label: "Support tickets",
      value: data.openTickets,
      note: data.openTickets > 0 ? "Awaiting reply" : "Nothing open",
      attention: data.openTickets > 0,
      href: "/admin/resources/SupportTicket",
    },
    {
      label: "Waitlist",
      value: data.waitlist,
      href: "/admin/resources/WaitlistEntry",
    },
  ];

  const trend = data.signupTrend || [];
  const peak = Math.max(1, ...trend.map((point) => point.count));

  return (
    <Page>
      <Hero>
        <Box>
          <H2 style={{ color: "#fff", margin: 0 }}>
            {greeting()}
            {data.adminName ? `, ${data.adminName}` : ""}
          </H2>
          <Text style={{ color: "rgba(255,255,255,0.82)", marginTop: 6 }}>
            Here's how Aeko is doing right now.
          </Text>
        </Box>
        <LivePill>
          <Dot $on={data.liveNow > 0} />
          {data.liveNow === null
            ? "Live status unavailable"
            : data.liveNow > 0
              ? `${fmt(data.liveNow)} stream${data.liveNow === 1 ? "" : "s"} live`
              : "No live streams"}
        </LivePill>
      </Hero>

      {data.failed?.length > 0 && (
        <Box style={{ marginBottom: 24 }}>
          <MessageBox variant="warning" message="Some figures could not be loaded">
            {data.failed.join(", ")} — shown as “—” below.
          </MessageBox>
        </Box>
      )}

      <Grid>
        {cards.map((card) => (
          <Card
            key={card.label}
            $clickable={Boolean(card.href)}
            onClick={card.href ? () => navigate(card.href) : undefined}
          >
            <CardLabel>{card.label}</CardLabel>
            <CardValue>{fmt(card.value)}</CardValue>
            {card.note && <Delta $attention={card.attention}>{card.note}</Delta>}
          </Card>
        ))}
      </Grid>

      <Columns>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Signups, last 14 days</H4>
          {trend.length === 0 ? (
            <Text style={{ color: MUTED }}>No signups in this period.</Text>
          ) : (
            <>
              <Bars>
                {trend.map((point) => (
                  <Bar
                    key={point.day}
                    $height={Math.max(4, (point.count / peak) * 100)}
                    $empty={point.count === 0}
                    title={`${point.day}: ${point.count}`}
                  />
                ))}
              </Bars>
              <Text style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
                Peak {fmt(peak)} in a day
              </Text>
            </>
          )}
        </Panel>

        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Newest members</H4>
          {!data.recentUsers?.length ? (
            <Text style={{ color: MUTED }}>No members yet.</Text>
          ) : (
            data.recentUsers.map((user) => (
              <Row key={user.id}>
                <Avatar $src={user.profilePicture}>
                  {!user.profilePicture && initials(user.name, user.username)}
                </Avatar>
                <RowText>
                  <Text style={{ fontWeight: 600, color: TEAL_DARK }}>
                    {user.name || user.username}
                    {user.goldenTick ? " ★" : user.blueTick ? " ✓" : ""}
                  </Text>
                  <Text style={{ fontSize: 12, color: MUTED }}>@{user.username}</Text>
                </RowText>
                <Text style={{ fontSize: 12, color: MUTED }}>
                  {relativeTime(user.createdAt)}
                </Text>
              </Row>
            ))
          )}
        </Panel>
      </Columns>
    </Page>
  );
};

export default Dashboard;
