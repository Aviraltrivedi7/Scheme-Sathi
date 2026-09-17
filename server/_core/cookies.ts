import type { CookieOptions, Request } from "express";
import { STANDALONE_MODE } from "./env";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // Standalone deployments serve the SPA and API from the same origin and are
  // commonly accessed over plain HTTP (localhost / LAN IPs). Browsers refuse
  // SameSite=None cookies without the Secure attribute, which would silently
  // break login on those deployments — so standalone uses the same-site-safe
  // "lax" policy instead of the platform's cross-domain "none". Secure rides
  // along whenever the request actually arrived over TLS (direct HTTPS or a
  // proxy that forwarded the protocol), and stays off for plain HTTP so the
  // cookie still lands on LAN deployments.
  if (STANDALONE_MODE) {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isSecureRequest(req),
    };
  }

  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}
