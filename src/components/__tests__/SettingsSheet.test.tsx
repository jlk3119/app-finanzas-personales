import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsSheet from "../SettingsSheet";

const setThemeMock = jest.fn();
let mockTheme = "system";

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: setThemeMock }),
}));

function renderSheet(overrides: Partial<React.ComponentProps<typeof SettingsSheet>> = {}) {
  const props = {
    onClose: jest.fn(),
    onManageCategories: jest.fn(),
    onSignOut: jest.fn(),
    ...overrides,
  };
  render(<SettingsSheet {...props} />);
  return props;
}

beforeEach(() => {
  setThemeMock.mockClear();
  mockTheme = "system";
});

describe("SettingsSheet", () => {
  it("muestra el menú de configuración con las tres opciones de tema", () => {
    renderSheet();
    expect(screen.getByText("Configuración")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /sistema/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /claro/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /oscuro/i })).toBeInTheDocument();
  });

  it("activa el modo oscuro de forma manual", async () => {
    renderSheet();
    await userEvent.click(screen.getByRole("radio", { name: /oscuro/i }));
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("permite volver a seguir la configuración del dispositivo (sistema)", async () => {
    mockTheme = "dark";
    renderSheet();
    await userEvent.click(screen.getByRole("radio", { name: /sistema/i }));
    expect(setThemeMock).toHaveBeenCalledWith("system");
  });

  it("marca el tema activo según la preferencia actual", () => {
    mockTheme = "dark";
    renderSheet();
    expect(screen.getByRole("radio", { name: /oscuro/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /claro/i })).toHaveAttribute("aria-checked", "false");
  });

  it("abre la gestión de categorías", async () => {
    const { onManageCategories } = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /categorías/i }));
    expect(onManageCategories).toHaveBeenCalled();
  });

  it("cierra la sesión", async () => {
    const { onSignOut } = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
