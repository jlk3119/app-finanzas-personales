import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrivacyProvider, usePrivacy } from "../PrivacyProvider";

function Consumer() {
  const { hidden, toggle, fmt } = usePrivacy();
  return (
    <div>
      <span data-testid="val">{fmt(1500)}</span>
      <span data-testid="hidden">{String(hidden)}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function renderConsumer() {
  render(
    <PrivacyProvider>
      <Consumer />
    </PrivacyProvider>,
  );
}

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* noop */ }
});

describe("PrivacyProvider", () => {
  it("muestra los montos formateados por defecto", () => {
    renderConsumer();
    expect(screen.getByTestId("hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("val")).toHaveTextContent("1.500");
  });

  it("enmascara los montos al activar el modo privacidad y lo persiste", async () => {
    renderConsumer();
    await userEvent.click(screen.getByRole("button", { name: /toggle/i }));
    expect(screen.getByTestId("hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("val")).toHaveTextContent("••••");
    expect(screen.getByTestId("val")).not.toHaveTextContent("1.500");
    expect(window.localStorage.getItem("mf-privacy")).toBe("1");
  });

  it("recupera la preferencia oculta desde localStorage", () => {
    window.localStorage.setItem("mf-privacy", "1");
    renderConsumer();
    expect(screen.getByTestId("hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("val")).toHaveTextContent("••••");
  });
});
