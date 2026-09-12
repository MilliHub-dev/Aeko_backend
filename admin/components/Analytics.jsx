import React, { useEffect, useState } from "react";
import { Box, H2, H4, Loader, MessageBox, Text } from "@adminjs/design-system";
import { ApiClient } from "adminjs";
import { useNavigate } from "react-router-dom";
// The design system's re-export, not bare "styled-components": only this
// specifier is aliased to the shared `styled` global by AdminJS's bundler, so a
// bare import creates a second styled-components instance whose ThemeContext is
// empty. See the note in Login.jsx.
import { styled } from "@adminjs/design-system/styled-components";

/**
 * Aeko analytics.
 *
 * The dashboard answers "how is it going right now"; this screen answers "what
 * changed and who is driving it". Every figure comes from the `analytics` page
 * handler in admin.js, which settles each query independently — a card whose
 * query failed shows "—" and is listed in a notice rather than reading as a
 * real zero.
 */

const TEAL = "#00BFA5";
const TEAL_DARK = "#003D3D";
const BORDER = "#DCE7E7";
const MUTED = "#5E7A7A";
const UP = "#047857";
const DOWN = "#C2410C";

const Page = styled(Box)`
  padding: 24px;
  background: #f7fafa;
  min-height: 100%;
`;

const Header = styled(Box)`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
`;

const Periods = styled(Box)`
  display: inline-flex;
  border: 1px solid ${BORDER};
  border-radius: 999px;
  background: #fff;
  overflow: hidden;
`;

const PeriodButton = styled.button`
  border: none;
  cursor: pointer;
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: ${(props) => (props.$active ? "#fff" : MUTED)};
  background: ${(props) => (props.$active ? TEAL : "transparent")};

  &:hover {
    background: ${(props) => (props.$active ? TEAL : "#E6F6F4")};
  }
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

const Trend = styled(Text)`
  font-size: 13px;
  margin-top: 6px;
  font-weight: 600;
  color: ${(props) => {
    if (props.$direction === "up") return UP;
    if (props.$direction === "down") return DOWN;
    return MUTED;
  }};
`;

const Columns = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
`;

const Panel = styled(Box)`
  background: #fff;
  border: 1px solid ${BORDER};
  border-radius: 14px;
  padding: 22px;
`;

const Bars = styled(Box)`
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 110px;
  margin-top: 12px;
`;

const Bar = styled(Box)`
  flex: 1;
  min-width: 3px;
  border-radius: 4px 4px 0 0;
  background: ${(props) => (props.$empty ? "#E6F6F4" : TEAL)};
  height: ${(props) => props.$height}%;
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
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${TEAL_DARK};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
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

const Split = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid #f0f5f5;

  &:last-child {
    border-bottom: none;
  }
`;

const Meter = styled(Box)`
  height: 8px;
  border-radius: 999px;
  background: #eef5f5;
  overflow: hidden;
  margin-top: 6px;
`;

const MeterFill = styled(Box)`
  height: 100%;
  border-radius: 999px;
  background: ${TEAL};
  width: ${(props) => props.$pct}%;
`;

const nf = new Intl.NumberFormat();
const fmt = (value) =>
  value === null || value === undefined ? "—" : nf.format(value);

const initials = (name, username) =>
  (name || username || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

/**
 * Percentage change against the preceding window of equal length.
 *
 * Growth from zero has no defined percentage, so it is reported as "new"
 * rather than as an infinite or 100% rise.
 */
const change = (current, previous) => {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined) return null;
  if (previous === 0) {
    return current === 0
      ? { direction: "flat", label: "No change" }
      : { direction: "up", label: `+${nf.format(current)} (new)` };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { direction: "flat", label: "Flat vs previous" };
  return {
    direction: pct > 0 ? "up" : "down",
    label: `${pct > 0 ? "+" : ""}${pct}% vs previous`,
  };
};

const Sparkline = ({ series, label }) => {
  if (!series?.length) {
    return <Text style={{ color: MUTED }}>No data in this period.</Text>;
  }
  const peak = Math.max(1, ...series.map((point) => point.count));
  const total = series.reduce((sum, point) => sum + point.count, 0);
  return (
    <>
      <Bars>
        {series.map((point) => (
          <Bar
            key={point.day}
            $height={Math.max(3, (point.count / peak) * 100)}
            $empty={point.count === 0}
            title={`${point.day}: ${point.count}`}
          />
        ))}
      </Bars>
      <Text style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
        {fmt(total)} {label} · peak {fmt(peak)} in a day
      </Text>
    </>
  );
};

const Breakdown = ({ rows, empty }) => {
  if (!rows?.length) return <Text style={{ color: MUTED }}>{empty}</Text>;
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return rows.map((row) => (
    <Box key={row.label} style={{ padding: "8px 0" }}>
      <Split style={{ border: "none", padding: 0 }}>
        <Text style={{ color: TEAL_DARK, textTransform: "capitalize" }}>
          {String(row.label).replace(/_/g, " ")}
        </Text>
        <Text style={{ fontWeight: 600, color: TEAL_DARK }}>
          {fmt(row.value)}
        </Text>
      </Split>
      <Meter>
        <MeterFill $pct={Math.round((row.value / total) * 100)} />
      </Meter>
    </Box>
  ));
};

const Analytics = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Switching period fires a new request while the previous one may still be
    // in flight. Every state write is guarded so a slower earlier response
    // cannot land after a newer one and show the wrong period's figures.
    let cancelled = false;

    setLoading(true);
    setError(null);

    new ApiClient()
      .getPage({ pageName: "analytics", method: "get", params: { days } })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) {
    return (
      <Page>
        <MessageBox variant="danger" message="Analytics unavailable">
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

  const periods = data.periods || [7, 14, 30, 90];

  const kpis = [
    {
      label: "New users",
      value: data.newUsers,
      delta: change(data.newUsers, data.newUsersPrevious),
    },
    {
      label: "Signed in",
      value: data.activeUsers,
      delta: change(data.activeUsers, data.activeUsersPrevious),
      // Counts users whose `lastLoginAt` falls in the period. That column was
      // only written by the OAuth routes until now, so historic logins were
      // never recorded and this reads low until people sign in again — it is a
      // floor, not a measure of everyone who used the app.
      note: "Logins recorded in this period",
    },
    {
      label: "New posts",
      value: data.newPosts,
      delta: change(data.newPosts, data.newPostsPrevious),
    },
    { label: "New comments", value: data.newComments },
    { label: "Messages sent", value: data.newMessages },
    {
      label: "Revenue",
      value: data.revenueInPeriod,
      money: true,
      note: "Completed transactions",
    },
  ];

  const health = data.accountHealth || {};
  const ticks = data.verification || {};

  return (
    <Page>
      <Header>
        <Box>
          <H2 style={{ margin: 0, color: TEAL_DARK }}>Analytics</H2>
          <Text style={{ color: MUTED, marginTop: 6 }}>
            Last {data.period} days, compared with the {data.period} before it.
          </Text>
        </Box>
        <Periods>
          {periods.map((period) => (
            <PeriodButton
              key={period}
              $active={period === data.period}
              onClick={() => setDays(period)}
              disabled={loading}
            >
              {period}d
            </PeriodButton>
          ))}
        </Periods>
      </Header>

      {data.failed?.length > 0 && (
        <Box style={{ marginBottom: 24 }}>
          <MessageBox variant="warning" message="Some figures could not be loaded">
            {data.failed.join(", ")} — shown as “—” below.
          </MessageBox>
        </Box>
      )}

      <Grid>
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardLabel>{kpi.label}</CardLabel>
            <CardValue>
              {kpi.money && kpi.value !== null && kpi.value !== undefined
                ? `$${fmt(kpi.value)}`
                : fmt(kpi.value)}
            </CardValue>
            {kpi.delta ? (
              <Trend $direction={kpi.delta.direction}>{kpi.delta.label}</Trend>
            ) : (
              kpi.note && <Trend $direction="flat">{kpi.note}</Trend>
            )}
          </Card>
        ))}
      </Grid>

      <Columns>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Signups</H4>
          <Sparkline series={data.signupSeries} label="signups" />
        </Panel>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Posts</H4>
          <Sparkline series={data.postSeries} label="posts" />
        </Panel>
      </Columns>

      <Columns>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Comments</H4>
          <Sparkline series={data.commentSeries} label="comments" />
        </Panel>

        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Account health</H4>
          <Breakdown
            empty="No users yet."
            rows={[
              { label: "Has a wallet", value: health.withWallet ?? 0 },
              { label: "Push enabled", value: health.withPush ?? 0 },
              { label: "Subscribed", value: health.subscribed ?? 0 },
              { label: "Banned", value: health.banned ?? 0 },
            ]}
          />
        </Panel>
      </Columns>

      <Columns>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Most active posters</H4>
          {!data.topPosters?.length ? (
            <Text style={{ color: MUTED }}>Nobody posted in this period.</Text>
          ) : (
            data.topPosters.map((user) => (
              <Row key={user.id}>
                <Avatar $src={user.profilePicture}>
                  {!user.profilePicture && initials(user.name, user.username)}
                </Avatar>
                <RowText>
                  <Text style={{ fontWeight: 600, color: TEAL_DARK }}>
                    {user.name || user.username}
                  </Text>
                  <Text style={{ fontSize: 12, color: MUTED }}>
                    @{user.username}
                  </Text>
                </RowText>
                <Text style={{ fontWeight: 600, color: TEAL_DARK }}>
                  {fmt(user.posts)}
                </Text>
              </Row>
            ))
          )}
        </Panel>

        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Biggest communities</H4>
          {!data.topCommunities?.length ? (
            <Text style={{ color: MUTED }}>No communities yet.</Text>
          ) : (
            data.topCommunities.map((community) => (
              <Row
                key={community.id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate("/admin/resources/Community")}
              >
                <Avatar>{initials(community.name, community.name)}</Avatar>
                <RowText>
                  <Text style={{ fontWeight: 600, color: TEAL_DARK }}>
                    {community.name}
                  </Text>
                </RowText>
                <Text style={{ fontSize: 12, color: MUTED }}>
                  {fmt(community._count?.community_members ?? 0)} member
                  {(community._count?.community_members ?? 0) === 1 ? "" : "s"}
                </Text>
              </Row>
            ))
          )}
        </Panel>
      </Columns>

      <Columns>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Verification</H4>
          <Breakdown
            empty="Nobody verified yet."
            rows={[
              { label: "Blue", value: ticks.blue ?? 0 },
              { label: "Golden", value: ticks.golden ?? 0 },
              { label: "Business", value: ticks.business ?? 0 },
              { label: "Pride", value: ticks.pride ?? 0 },
            ]}
          />
        </Panel>

        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Moderation queue</H4>
          <Breakdown
            empty="No reports filed."
            rows={(data.reportsByStatus || []).map((row) => ({
              label: row.status,
              value: row._count?._all ?? 0,
            }))}
          />
          <H4 style={{ color: TEAL_DARK, marginBottom: 4 }}>Support tickets</H4>
          <Breakdown
            empty="No tickets raised."
            rows={(data.ticketsByStatus || []).map((row) => ({
              label: row.status,
              value: row._count?._all ?? 0,
            }))}
          />
        </Panel>
      </Columns>

      <Columns>
        <Panel>
          <H4 style={{ marginTop: 0, color: TEAL_DARK }}>Transactions</H4>
          <Breakdown
            empty="No transactions recorded."
            rows={(data.transactionsByStatus || []).map((row) => ({
              label: row.status,
              value: row._count?._all ?? 0,
            }))}
          />
        </Panel>
      </Columns>

      <Text style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
        Generated {new Date(data.generatedAt).toLocaleString()}
      </Text>
    </Page>
  );
};

export default Analytics;
