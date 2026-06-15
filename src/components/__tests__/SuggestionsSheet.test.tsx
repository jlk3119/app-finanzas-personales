/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SuggestionsSheet from "../SuggestionsSheet";
import { createClient } from "@/utils/supabase/client";
import type { Suggestion } from "@/types";

jest.mock("@/utils/supabase/client", () => ({ createClient: jest.fn() }));
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const existing: Suggestion[] = [
  { id: "s-1", user_id: "u1", text: "Exportar a PDF", status: "pending", created_at: "2026-06-10" },
  { id: "s-2", user_id: "u1", text: "Modo widget", status: "done", created_at: "2026-06-09" },
];

type MockOpts = { listData?: Suggestion[]; listError?: boolean; insertError?: boolean };

function makeMock({ listData = existing, listError = false, insertError = false }: MockOpts = {}) {
  const order = jest.fn().mockResolvedValue({ data: listError ? null : listData, error: listError ? new Error("fail") : null });
  const select = jest.fn().mockReturnValue({ order });
  const insertSingle = jest.fn().mockResolvedValue({
    data: insertError ? null : { id: "s-new", user_id: "u1", text: "Nueva idea", status: "pending", created_at: "2026-06-15" },
    error: insertError ? new Error("fail") : null,
  });
  const insert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: insertSingle }) });
  const deleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
  const del = jest.fn().mockReturnValue({ eq: deleteEq });
  const from = jest.fn().mockReturnValue({ select, insert, delete: del });
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from,
  } as any);
  return { insert, deleteEq };
}

beforeEach(() => makeMock());
afterEach(() => jest.clearAllMocks());

describe("SuggestionsSheet", () => {
  it("renderiza el formulario de sugerencias", async () => {
    render(<SuggestionsSheet onClose={jest.fn()} />);
    expect(screen.getByRole("textbox", { name: /tu sugerencia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar sugerencia/i })).toBeInTheDocument();
  });

  it("carga y muestra las sugerencias existentes del usuario", async () => {
    render(<SuggestionsSheet onClose={jest.fn()} />);
    expect(await screen.findByText("Exportar a PDF")).toBeInTheDocument();
    expect(screen.getByText("Modo widget")).toBeInTheDocument();
    expect(screen.getByText("Implementada")).toBeInTheDocument();
  });

  it("deshabilita el botón enviar cuando el texto está vacío", () => {
    render(<SuggestionsSheet onClose={jest.fn()} />);
    expect(screen.getByRole("button", { name: /enviar sugerencia/i })).toBeDisabled();
  });

  it("envía una sugerencia y la agrega a la lista con confirmación", async () => {
    const { insert } = makeMock();
    const user = userEvent.setup();
    render(<SuggestionsSheet onClose={jest.fn()} />);
    await screen.findByText("Exportar a PDF");
    await user.type(screen.getByRole("textbox", { name: /tu sugerencia/i }), "Nueva idea");
    await user.click(screen.getByRole("button", { name: /enviar sugerencia/i }));
    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({ user_id: "u1", text: "Nueva idea" });
    });
    expect(await screen.findByText(/tu sugerencia fue enviada/i)).toBeInTheDocument();
    expect(screen.getByText("Nueva idea")).toBeInTheDocument();
  });

  it("muestra un mensaje de error si falla el envío", async () => {
    makeMock({ insertError: true });
    const user = userEvent.setup();
    render(<SuggestionsSheet onClose={jest.fn()} />);
    await user.type(screen.getByRole("textbox", { name: /tu sugerencia/i }), "Algo");
    await user.click(screen.getByRole("button", { name: /enviar sugerencia/i }));
    expect(await screen.findByText(/no se pudo enviar/i)).toBeInTheDocument();
  });

  it("elimina una sugerencia tras confirmar", async () => {
    const { deleteEq } = makeMock();
    const user = userEvent.setup();
    render(<SuggestionsSheet onClose={jest.fn()} />);
    await screen.findByText("Exportar a PDF");
    const deleteButtons = screen.getAllByRole("button", { name: /eliminar sugerencia/i });
    await user.click(deleteButtons[0]);
    await screen.findByText(/¿eliminar esta sugerencia\?/i);
    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));
    await waitFor(() => {
      expect(deleteEq).toHaveBeenCalledWith("id", "s-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("Exportar a PDF")).not.toBeInTheDocument();
    });
  });

  it("muestra estado vacío cuando no hay sugerencias", async () => {
    makeMock({ listData: [] });
    render(<SuggestionsSheet onClose={jest.fn()} />);
    expect(await screen.findByText(/aún no has enviado sugerencias/i)).toBeInTheDocument();
  });
});
