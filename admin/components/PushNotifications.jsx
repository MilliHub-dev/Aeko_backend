import React, { useEffect, useState } from "react";
import {
  Box,
  H2,
  Input,
  Label,
  Loader,
  MessageBox,
  Text,
  TextArea,
} from "@adminjs/design-system";
import { ApiClient } from "adminjs";
// The design system's re-export, not bare "styled-components" — see the note
// in Login.jsx for why a bare import breaks theming.
import styled from "@adminjs/design-system/styled-components";

/**
 * Send a push notification to the app's users.
 *
 * Every send is also written to the Notification table, so it appears in the
 * in-app notification list even for someone whose device is unreachable.
 */

const TEAL = "#00BFA5";
const TEAL_DARK = "#003D3D";
const BORDER = "#DCE7E7";
const MUTED = "#5E7A7A";

const Page = styled(Box)`
  padding: 24px;
  background: #f7fafa;
  min-height: 100%;
`;

const Card = styled(Box)`
  max-width: 720px;
  background: #fff;
  border: 1px solid ${BORDER};
  border-radius: 16px;
  padding: 24px;
`;

const Audience = styled(Box)`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
`;

const Stat = styled(Box)`
  flex: 1 1 160px;
  border: 1px solid ${BORDER};
  border-radius: 12px;
  padding: 14px 16px;
`;

const StatValue = styled(Text)`
  font-size: 24px;
  font-weight: 700;
  color: ${TEAL_DARK};
`;

const StatLabel = styled(Text)`
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: ${MUTED};
`;

const Field = styled(Box)`
  margin-bottom: 18px;
`;

const Targets = styled(Box)`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
`;

const TargetButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? TEAL : BORDER)};
  background: ${(props) => (props.$active ? TEAL : "#fff")};
  color: ${(props) => (props.$active ? "#fff" : TEAL_DARK)};
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

const Send = styled.button`
  background: ${TEAL};
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px 28px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.55 : 1)};
`;

const Preview = styled(Box)`
  border: 1px dashed ${BORDER};
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 18px;
  background: #f7fafa;
`;

const TARGETS = [
  { key: "all", label: "Everyone" },
  { key: "subscribers", label: "Subscribers only" },
  { key: "user", label: "One user" },
];

const MAX_TITLE = 65;
const MAX_MESSAGE = 240;

const PushNotifications = () => {
  const [audience, setAudience] = useState(null);
  const [target, setTarget] = useState("all");
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const api = new ApiClient();

  useEffect(() => {
    let cancelled = false;
    api
      .getPage({ pageName: "pushNotifications" })
      .then((response) => {
        if (!cancelled) setAudience(response.data?.audience ?? null);
      })
      .catch(() => {
        // The counts are a convenience; sending still works without them.
        if (!cancelled) setAudience(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reach =
    target === "subscribers"
      ? audience?.subscribers
      : target === "user"
        ? null
        : audience?.reachable;

  const canSend =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (target !== "user" || username.trim().length > 0) &&
    !sending;

  const submit = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.getPage({
        pageName: "pushNotifications",
        method: "post",
        data: { title, message, target, username },
      });
      if (response.data?.error) {
        setError(response.data.error);
      } else {
        setResult(response.data?.result ?? null);
        setTitle("");
        setMessage("");
      }
    } catch (err) {
      setError(err.message || "The notification could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Page>
      <H2 mb="8px">Push notifications</H2>
      <Text mb="24px" color="grey60">
        Sends to the Aeko app and records the message in every recipient&apos;s
        notification list.
      </Text>

      <Card>
        {audience === null ? (
          <Loader />
        ) : (
          <Audience>
            <Stat>
              <StatLabel>Total users</StatLabel>
              <StatValue>{audience.total}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Reachable devices</StatLabel>
              <StatValue>{audience.reachable}</StatValue>
              <Text fontSize="12px" color={MUTED}>
                Users who have opened the app and allowed notifications
              </Text>
            </Stat>
            <Stat>
              <StatLabel>Subscribers reachable</StatLabel>
              <StatValue>{audience.subscribers}</StatValue>
            </Stat>
          </Audience>
        )}

        <Label>Audience</Label>
        <Targets>
          {TARGETS.map((option) => (
            <TargetButton
              key={option.key}
              type="button"
              $active={target === option.key}
              onClick={() => setTarget(option.key)}
            >
              {option.label}
            </TargetButton>
          ))}
        </Targets>

        {target === "user" && (
          <Field>
            <Label required>Username</Label>
            <Input
              width="100%"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. johnsmith"
            />
          </Field>
        )}

        <Field>
          <Label required>Title</Label>
          <Input
            width="100%"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Something new on Aeko"
          />
          <Text fontSize="12px" color={MUTED}>
            {title.length}/{MAX_TITLE}
          </Text>
        </Field>

        <Field>
          <Label required>Message</Label>
          <TextArea
            width="100%"
            rows={4}
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Keep it short — long text is cut off on the lock screen."
          />
          <Text fontSize="12px" color={MUTED}>
            {message.length}/{MAX_MESSAGE}
          </Text>
        </Field>

        {(title || message) && (
          <Preview>
            <StatLabel>Preview</StatLabel>
            <Text fontWeight="bold" color={TEAL_DARK}>
              {title || "Title"}
            </Text>
            <Text color={MUTED}>{message || "Message"}</Text>
          </Preview>
        )}

        {error && (
          <MessageBox variant="danger" message="Not sent" mb="18px">
            {error}
          </MessageBox>
        )}

        {result && (
          <MessageBox variant="success" message="Notification sent" mb="18px">
            Delivered to {result.sent} device
            {result.sent === 1 ? "" : "s"}, recorded for {result.recorded} user
            {result.recorded === 1 ? "" : "s"}
            {result.failed > 0 ? `, ${result.failed} failed` : ""}
            {result.paused > 0
              ? `. ${result.paused} had notifications paused, so they were recorded in-app only.`
              : "."}
          </MessageBox>
        )}

        <Send type="button" disabled={!canSend} onClick={submit}>
          {sending
            ? "Sending…"
            : target === "user"
              ? "Send to user"
              : `Send to ${reach ?? "…"} device${reach === 1 ? "" : "s"}`}
        </Send>
      </Card>
    </Page>
  );
};

export default PushNotifications;
