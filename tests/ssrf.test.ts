import { describe, it, expect } from "vitest";
import { assertPublicHttpUrl, SsrfBlockedError } from "@/lib/ssrf";

describe("SSRF guard (section 32)", () => {
  it("allows public https hosts", () => {
    expect(assertPublicHttpUrl("https://yle.fi/a/20-10009579").hostname).toBe("yle.fi");
    expect(assertPublicHttpUrl("https://avoindata.eduskunta.fi/api/v1/seating/").hostname).toBe("avoindata.eduskunta.fi");
    expect(assertPublicHttpUrl("http://example.com/path").hostname).toBe("example.com");
  });

  it("rejects loopback and private network hosts", () => {
    for (const url of [
      "http://localhost:3000/",
      "http://127.0.0.1/admin",
      "http://0.0.0.0/",
      "http://10.0.0.1/",
      "http://192.168.1.1/",
      "http://172.16.0.1/",
      "http://172.31.255.1/",
      "http://169.254.169.254/latest/meta-data",
    ]) {
      expect(() => assertPublicHttpUrl(url)).toThrow(SsrfBlockedError);
    }
  });

  it("rejects IPv6 loopback / link-local / ULA", () => {
    for (const url of ["http://[::1]/", "http://[fe80::1]/", "http://[fc00::1]/", "http://[fd00::1]/"]) {
      expect(() => assertPublicHttpUrl(url)).toThrow(SsrfBlockedError);
    }
  });

  it("rejects cloud-metadata hostnames and unsafe schemes", () => {
    for (const url of [
      "http://metadata.google.internal/",
      "http://metadata.azure.internal/",
      "http://metadata.aws.internal/",
      "file:///etc/passwd",
      "gopher://localhost/",
      "ftp://example.com/",
    ]) {
      expect(() => assertPublicHttpUrl(url)).toThrow(SsrfBlockedError);
    }
  });
});