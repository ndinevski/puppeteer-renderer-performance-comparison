import * as pulumi from "@pulumi/pulumi";
import { beforeEach, describe, expect, it } from "vitest";

import { mergeInfrastructureConfig } from "../src/config";
import { AzureCloudProvider } from "../src/providers/azureProvider";

const resolveOutput = async <T>(output: pulumi.Output<T>): Promise<T> =>
  new Promise<T>((resolve) => {
    output.apply((value) => {
      resolve(value);
      return value;
    });
  });

describe("AzureCloudProvider", () => {
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

          if (args.type === "azure-native:network:PublicIPAddress") {
            state.ipAddress = "20.30.40.50";
          }

          if (args.type === "azure-native:web:WebApp") {
            state.defaultHostName = "renderer-func.azurewebsites.net";
          }

          if (args.type === "azure-native:containerservice:ManagedCluster") {
            state.name = "test-renderer-aks";
          }

          if (args.type === "kubernetes:core/v1:Service") {
            state.metadata = { name: "puppeteer-service" };
          }

          return {
            id: `${args.name}-id`,
            state,
          };
        },
        call: (args) => {
          if (
            args.token ===
            "azure-native:storage:listStorageAccountKeys"
          ) {
            return {
              keys: [{ value: "mockStorageKey" }],
            };
          }

          if (
            args.token ===
            "azure-native:containerservice:listManagedClusterUserCredentials"
          ) {
            return {
              kubeconfigs: [
                {
                  value: Buffer.from("apiVersion: v1\nkind: Config\n").toString(
                    "base64",
                  ),
                },
              ],
            };
          }

          return args.inputs;
        },
      },
      "test-project",
      "test-stack",
      false,
    );
  });

  it("builds VM, Function App and AKS resources from shared config", async () => {
    const provider = new AzureCloudProvider(
      mergeInfrastructureConfig({
        cloud: "azure",
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

    expect(containerServiceUrl).toContain("20.30.40.50");
    expect(functionServiceUrl).toBe("https://renderer-func.azurewebsites.net");
    expect(kubernetesServiceName).toBe("puppeteer-service");

    expect(createdResourceTypes).toContain("azure-native:compute:VirtualMachine");
    expect(createdResourceTypes).toContain("azure-native:web:WebApp");
    expect(createdResourceTypes).toContain(
      "azure-native:containerservice:ManagedCluster",
    );
    expect(createdResourceTypes).toContain("kubernetes:apps/v1:Deployment");
    expect(createdResourceTypes).toContain("kubernetes:core/v1:Service");
  });
});
