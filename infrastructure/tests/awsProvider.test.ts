import * as pulumi from "@pulumi/pulumi";
import { beforeEach, describe, expect, it } from "vitest";

import { mergeInfrastructureConfig } from "../src/config";
import { AwsCloudProvider } from "../src/providers/awsProvider";

const resolveOutput = async <T>(output: pulumi.Output<T>): Promise<T> =>
  new Promise<T>((resolve) => {
    output.apply((value) => {
      resolve(value);
      return value;
    });
  });

describe("AwsCloudProvider", () => {
  const createdResourceTypes: string[] = [];

  beforeEach(() => {
    createdResourceTypes.length = 0;

    pulumi.runtime.setMocks(
      {
        newResource: (args) => {
          createdResourceTypes.push(args.type);

          const state: Record<string, unknown> = {
            ...args.inputs,
            name: args.name,
          };

          if (args.type === "aws:ec2/instance:Instance") {
            state.publicIp = "1.2.3.4";
          }

          if (args.type === "aws:lambda/functionUrl:FunctionUrl") {
            state.functionUrl = "https://example.lambda-url.aws/";
          }

          if (args.type === "aws:eks/cluster:Cluster") {
            state.endpoint = "https://mock-eks-endpoint.local";
            state.certificateAuthority = {
              data: "mock-certificate-data",
            };
          }

          if (args.type === "kubernetes:core/v1:Service") {
            state.metadata = { name: "puppeteer-service" };
          }

          return {
            id: `${args.name}-id`,
            state,
          };
        },
        call: (args) => args.inputs,
      },
      "test-project",
      "test-stack",
      false,
    );
  });

  it("builds EC2, Lambda and EKS resources from shared config", async () => {
    const provider = new AwsCloudProvider(
      mergeInfrastructureConfig({
        cloud: "aws",
        projectName: "test-renderer",
        lambda: {
          packagePath: "../lambda-renderer-puppeteer",
        },
      }),
    );

    const outputs = provider.deploy();

    const containerServiceUrl = await resolveOutput(outputs.containerServiceUrl!);
    const functionServiceUrl = await resolveOutput(outputs.functionServiceUrl!);
    const kubernetesServiceName = await resolveOutput(
      outputs.kubernetesServiceName!,
    );

    expect(containerServiceUrl).toContain("1.2.3.4");
    expect(functionServiceUrl).toContain("https://example.lambda-url.aws/");
    expect(kubernetesServiceName).toBe("puppeteer-service");

    expect(createdResourceTypes).toContain("aws:ec2/instance:Instance");
    expect(createdResourceTypes).toContain("aws:lambda/function:Function");
    expect(createdResourceTypes).toContain("aws:eks/cluster:Cluster");
    expect(createdResourceTypes).toContain("kubernetes:apps/v1:Deployment");
    expect(createdResourceTypes).toContain("kubernetes:core/v1:Service");
  });
});
