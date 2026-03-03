# Infrastructure (Pulumi + TypeScript)

This folder contains infrastructure as code for:
- VM (containerized renderer)
- FaaS (serverless renderer)
- Kubernetes Service (Kubernetes renderer deployment + service)

## Design

The implementation uses an object-oriented provider abstraction:
- `src/providers/cloudProvider.ts` defines a shared contract (`deploy()`)
- `src/providers/awsProvider.ts` contains AWS-specific resources
- `src/providers/azureProvider.ts` contains Azure-specific resources
- `src/providers/providerFactory.ts` selects provider by `cloud` config

All services read from the same shared settings in `InfrastructureConfig` (`src/types.ts` + `src/config.ts`), so migration between clouds is a provider implementation concern, not a service config rewrite.

## Local setup

```bash
cd infrastructure
npm install
npm run build
npm test
```

## Pulumi stack config

Sample stack config is in `Pulumi.dev.yaml`.

Key values:
- `renderer-infrastructure:cloud`: `aws` or `azure`
- `renderer-infrastructure:region`: cloud region/location (e.g. `eu-west-1` for AWS, `westeurope` for Azure)
- `renderer-infrastructure:renderer`: shared image/port/env for EC2 + EKS (+ Lambda env)
- `renderer-infrastructure:ec2`, `renderer-infrastructure:lambda`, `renderer-infrastructure:eks`: service-specific sizing and runtime values

## Azure resources

When `renderer-infrastructure:cloud` is set to `azure`, the stack creates:
- Virtual network + subnets + NSG
- Linux VM that boots Docker and runs the renderer container
- Function App (Node.js) with package blob deployment (`WEBSITE_RUN_FROM_PACKAGE`)
- AKS cluster and Kubernetes deployment/service for renderer

Set VM password as secret before preview/deploy:

```bash
pulumi config set --secret azure-native:vmAdminPassword "<strong-password>"
```

## Select provider

Set provider to AWS:

```bash
cd infrastructure
pulumi stack select dev
pulumi config set cloud aws
```

Set provider to Azure:

```bash
cd infrastructure
pulumi stack select dev
pulumi config set cloud azure
```

Check currently selected provider:

```bash
pulumi config get cloud
```

## Preview with AWS (no deployment)

```bash
cd infrastructure
pulumi stack init dev   # only once
pulumi stack select dev
pulumi config set cloud aws
pulumi config set aws:region eu-west-1
pulumi preview
```

## Preview with Azure (no deployment)

```bash
cd infrastructure
pulumi stack init dev   # only once
pulumi stack select dev
pulumi config set renderer-infrastructure:cloud azure
pulumi config set azure-native:location westeurope
pulumi config set --secret azure-native:vmAdminPassword "<strong-password>"
pulumi preview
```

## Deployment

Deploy the currently selected stack/provider:

```bash
cd infrastructure
pulumi up
```
