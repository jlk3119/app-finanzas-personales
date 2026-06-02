import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/ThemeToggle";

const setThemeMock = jest.fn();
let mockResolvedTheme = "light";

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme, setTheme: setThemeMock }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    setThemeMock.mockClear();
    mockResolvedTheme = "light";
  });

  it("expone un control accesible para cambiar el tema", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /cambiar tema/i })).toBeInTheDocument();
  });

  it("activa el modo oscuro cuando el tema actual es claro", () => {
    mockResolvedTheme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar tema/i }));
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("vuelve al modo claro cuando el tema actual es oscuro", () => {
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar tema/i }));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
