import React from "react";
import { Box, Input, Label, MessageBox, Text } from "@adminjs/design-system";
import { useSelector } from "react-redux";
import styled from "styled-components";

/**
 * Aeko sign-in screen, replacing the stock AdminJS login.
 *
 * The default shows a purple panel with astronaut and planet illustrations and
 * AdminJS's own copy — nothing to do with this product.
 *
 * The submit path is deliberately unchanged: AdminJS authenticates a plain form
 * POST of `email` and `password` to `window.__APP_STATE__.action`, and the
 * session cookie is set by that response. Intercepting it in JavaScript would
 * break sign-in, so this is a restyle of the same native form.
 */

const TEAL = "#00BFA5";
const TEAL_DARK = "#003D3D";
const LIME = "#99FF00";
const MUTED = "#5E7A7A";

const Screen = styled(Box)`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(1000px 500px at 15% -10%, rgba(0, 191, 165, 0.35), transparent 60%),
    radial-gradient(800px 400px at 100% 100%, rgba(153, 255, 0, 0.12), transparent 55%),
    ${TEAL_DARK};
`;

const Card = styled(Box)`
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 18px;
  padding: 40px 36px;
  box-shadow: 0 24px 60px rgba(0, 20, 20, 0.35);
`;

const Mark = styled(Box)`
  width: 52px;
  height: 52px;
  border-radius: 14px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
`;

const Logo = styled.img`
  max-width: 160px;
  margin: 0 auto 20px;
  display: block;
`;

const Title = styled.h1`
  margin: 0 0 6px;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: ${TEAL_DARK};
`;

const Subtitle = styled(Text)`
  display: block;
  text-align: center;
  color: ${MUTED};
  font-size: 14px;
  margin-bottom: 28px;
`;

const Field = styled(Box)`
  margin-bottom: 18px;

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${TEAL_DARK};
  }

  input {
    width: 100%;
    border-radius: 10px;

    &:focus {
      border-color: ${TEAL};
      box-shadow: 0 0 0 3px rgba(0, 191, 165, 0.18);
    }
  }
`;

const Submit = styled.button`
  width: 100%;
  margin-top: 8px;
  padding: 13px 16px;
  border: none;
  border-radius: 10px;
  background: ${TEAL};
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;

  &:hover {
    background: #00a892;
  }

  &:active {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: 3px solid ${LIME};
    outline-offset: 2px;
  }
`;

const Footer = styled(Text)`
  display: block;
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: ${MUTED};
`;

const Login = () => {
  // Set by AdminJS when it renders the login route.
  const appState = (typeof window !== "undefined" && window.__APP_STATE__) || {};
  const { action, errorMessage } = appState;
  const branding = useSelector((state) => state.branding) || {};
  const companyName = branding.companyName || "Aeko Admin";

  return (
    <Screen>
      <Card>
        {branding.logo ? (
          <Logo src={branding.logo} alt={companyName} />
        ) : (
          <Mark>AE</Mark>
        )}

        <Title>{companyName}</Title>
        <Subtitle>Sign in to manage the platform.</Subtitle>

        {errorMessage && (
          <Box style={{ marginBottom: 18 }}>
            <MessageBox variant="danger" message={errorMessage} />
          </Box>
        )}

        {/* Native POST — AdminJS sets the session from this response. */}
        <form action={action} method="POST">
          <Field>
            <Label required htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@aeko.online"
              autoComplete="username"
              required
            />
          </Field>

          <Field>
            <Label required htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Submit type="submit">Sign in</Submit>
        </form>

        <Footer>Authorised administrators only.</Footer>
      </Card>
    </Screen>
  );
};

export default Login;
