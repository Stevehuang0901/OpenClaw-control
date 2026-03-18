import net from "node:net";
import tls from "node:tls";

import type {
  GatewayProbeInput,
  GatewayProbeResult
} from "../../../../packages/shared/src/index";

const probeTimeoutMs = 3_500;

export const validateGatewayUrl = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Gateway URL is required.";
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      return "Gateway URL must start with ws:// or wss://.";
    }

    if (!hasExplicitPort(trimmed)) {
      return "Gateway URL must include an explicit port.";
    }

    return null;
  } catch {
    return "Enter a valid gateway URL including port.";
  }
};

export const probeGatewayConnection = async (
  input: GatewayProbeInput
): Promise<GatewayProbeResult> => {
  const gatewayUrl = input.gatewayUrl.trim();
  const validationError = validateGatewayUrl(gatewayUrl);

  if (validationError) {
    throw new Error(validationError);
  }

  const url = new URL(gatewayUrl);
  const secure = url.protocol === "wss:";
  const hostname = url.hostname;
  const port = extractExplicitPort(gatewayUrl);
  const tokenSupplied = Boolean(input.gatewayToken?.trim());
  const checkedAt = new Date().toISOString();

  if (port === null) {
    throw new Error("Gateway URL must include a valid explicit port.");
  }

  try {
    const connectLatencyMs = await connectToGateway({
      hostname,
      port,
      secure,
      allowInsecureTls: input.gatewayAllowInsecureTls
    });

    return {
      checkedAt,
      gatewayUrl,
      reachable: true,
      connectLatencyMs,
      secure,
      tokenSupplied,
      gatewayDisableDevicePairing: input.gatewayDisableDevicePairing,
      gatewayAllowInsecureTls: input.gatewayAllowInsecureTls,
      message: `Gateway port reachable in ${connectLatencyMs}ms.`
    };
  } catch (error) {
    return {
      checkedAt,
      gatewayUrl,
      reachable: false,
      connectLatencyMs: null,
      secure,
      tokenSupplied,
      gatewayDisableDevicePairing: input.gatewayDisableDevicePairing,
      gatewayAllowInsecureTls: input.gatewayAllowInsecureTls,
      message:
        error instanceof Error
          ? error.message
          : "Unable to reach the configured gateway."
    };
  }
};

const connectToGateway = (input: {
  hostname: string;
  port: number;
  secure: boolean;
  allowInsecureTls: boolean;
}) =>
  new Promise<number>((resolve, reject) => {
    const startedAt = Date.now();

    const socket = input.secure
      ? tls.connect({
          host: input.hostname,
          port: input.port,
          servername: input.hostname,
          rejectUnauthorized: !input.allowInsecureTls
        })
      : net.connect({
          host: input.hostname,
          port: input.port
        });

    const finish = (callback: () => void) => {
      socket.removeAllListeners();
      socket.destroy();
      callback();
    };

    socket.setTimeout(probeTimeoutMs);

    socket.once(input.secure ? "secureConnect" : "connect", () => {
      const latency = Date.now() - startedAt;
      finish(() => {
        resolve(latency);
      });
    });

    socket.once("timeout", () => {
      finish(() => {
        reject(new Error("Gateway probe timed out."));
      });
    });

    socket.once("error", (error) => {
      finish(() => {
        reject(error);
      });
    });
  });

const hasExplicitPort = (urlString: string): boolean =>
  extractExplicitPort(urlString) !== null;

const extractExplicitPort = (urlString: string): number | null => {
  try {
    const withoutScheme = urlString.slice(urlString.indexOf("//") + 2);
    const authority = withoutScheme.split(/[/?#]/)[0];
    if (!authority) {
      return null;
    }

    const atIndex = authority.lastIndexOf("@");
    const hostPort = atIndex === -1 ? authority : authority.slice(atIndex + 1);

    let portSegment = "";
    if (hostPort.startsWith("[")) {
      const closingBracketIndex = hostPort.indexOf("]");
      if (closingBracketIndex === -1) {
        return null;
      }

      portSegment = hostPort.slice(closingBracketIndex + 1);
    } else {
      const lastColonIndex = hostPort.lastIndexOf(":");
      if (lastColonIndex === -1) {
        return null;
      }

      portSegment = hostPort.slice(lastColonIndex);
    }

    if (!portSegment.startsWith(":") || !/^:\d+$/.test(portSegment)) {
      return null;
    }

    const port = Number.parseInt(portSegment.slice(1), 10);
    return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : null;
  } catch {
    return null;
  }
};
