import { describe, expect, it } from "vitest";

import { mergeInfrastructureConfig } from "../src/config";

describe("mergeInfrastructureConfig", () => {
  it("merges nested renderer environment values", () => {
    const config = mergeInfrastructureConfig({
      renderer: {
        environment: {
          CUSTOM_FLAG: "1",
        },
      },
    });

    expect(config.renderer.environment.PORT).toBe("8080");
    expect(config.renderer.environment.CUSTOM_FLAG).toBe("1");
  });

  it("allows overriding service sizing settings", () => {
    const config = mergeInfrastructureConfig({
      ec2: {
        instanceType: "t3.large",
      },
      lambda: {
        memorySize: 2048,
      },
      eks: {
        replicas: 3,
      },
    });

    expect(config.ec2.instanceType).toBe("t3.large");
    expect(config.lambda.memorySize).toBe(2048);
    expect(config.eks.replicas).toBe(3);
  });
});
