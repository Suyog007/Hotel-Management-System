import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: h.createTransport,
  },
}));

beforeEach(() => {
  vi.resetModules();
  h.sendMail.mockReset();
  h.createTransport.mockReset();
  h.createTransport.mockReturnValue({ sendMail: h.sendMail });
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_FROM_NAME;
});

describe("sendEmail", () => {
  it("no-ops and returns skipped:true when GMAIL_APP_PASSWORD is unset", async () => {
    const { sendEmail } = await import("@/lib/email");
    const res = await sendEmail({ to: "guest@x.com", subject: "Hi", html: "<p>hi</p>" });
    expect(res).toEqual({ id: null, skipped: true });
    expect(h.sendMail).not.toHaveBeenCalled();
  });

  it("throws a clear error if GMAIL_APP_PASSWORD is set but GMAIL_USER is not", async () => {
    process.env.GMAIL_APP_PASSWORD = "app-pass";
    const { sendEmail } = await import("@/lib/email");
    await expect(sendEmail({ to: "guest@x.com", subject: "Hi", html: "<p>hi</p>" })).rejects.toThrow(
      /GMAIL_USER/,
    );
  });

  it("sends via the Gmail SMTP transport when fully configured", async () => {
    process.env.GMAIL_APP_PASSWORD = "app pass with spaces";
    process.env.GMAIL_USER = "hotel@gmail.com";
    process.env.GMAIL_FROM_NAME = "Grand Stay";
    h.sendMail.mockResolvedValue({ messageId: "msg-1" });

    const { sendEmail } = await import("@/lib/email");
    const res = await sendEmail({ to: "guest@x.com", subject: "Booking confirmed", html: "<p>hi</p>", text: "hi" });

    expect(res).toEqual({ id: "msg-1", skipped: false });
    expect(h.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "hotel@gmail.com", pass: "apppasswithspaces" },
      }),
    );
    expect(h.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Grand Stay" <hotel@gmail.com>',
        to: "guest@x.com",
        subject: "Booking confirmed",
        html: "<p>hi</p>",
        text: "hi",
      }),
    );
  });

  it("joins an array of recipients with a comma", async () => {
    process.env.GMAIL_APP_PASSWORD = "app-pass";
    process.env.GMAIL_USER = "hotel@gmail.com";
    h.sendMail.mockResolvedValue({ messageId: "msg-2" });

    const { sendEmail } = await import("@/lib/email");
    await sendEmail({ to: ["a@x.com", "b@x.com"], subject: "Hi", html: "<p>hi</p>" });

    expect(h.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@x.com,b@x.com" }));
  });

  it("reuses the same transport across calls instead of recreating it", async () => {
    process.env.GMAIL_APP_PASSWORD = "app-pass";
    process.env.GMAIL_USER = "hotel@gmail.com";
    h.sendMail.mockResolvedValue({ messageId: "msg-3" });

    const { sendEmail } = await import("@/lib/email");
    await sendEmail({ to: "a@x.com", subject: "Hi", html: "<p>hi</p>" });
    await sendEmail({ to: "b@x.com", subject: "Hi", html: "<p>hi</p>" });

    expect(h.createTransport).toHaveBeenCalledTimes(1);
  });
});

describe("renderTemplate", () => {
  it("replaces {{key}} placeholders with provided values", async () => {
    const { renderTemplate } = await import("@/lib/email");
    expect(renderTemplate("Hello {{name}}, total {{total}}", { name: "Sam", total: 2500 })).toBe(
      "Hello Sam, total 2500",
    );
  });

  it("leaves unknown placeholders untouched so gaps are visible", async () => {
    const { renderTemplate } = await import("@/lib/email");
    expect(renderTemplate("Hi {{name}}, code {{missing}}", { name: "Sam" })).toBe(
      "Hi Sam, code {{missing}}",
    );
  });

  it("tolerates whitespace inside the placeholder braces", async () => {
    const { renderTemplate } = await import("@/lib/email");
    expect(renderTemplate("{{  name  }}", { name: "Sam" })).toBe("Sam");
  });
});
