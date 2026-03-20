const { ECSClient, RunTaskCommand, UpdateServiceCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { config } = require('../../config/env');
const logger = require('../../lib/logger');

class EcsRuntimeAdapter {
  constructor() {
    this.client = new ECSClient({ region: config.aws.region });
  }

  enabled() {
    return Boolean(config.aws.ecsCluster && config.aws.ecsTaskDefinition && config.aws.ecsSubnets.length);
  }

  async provisionTenantRuntime(tenantId) {
    if (!this.enabled()) {
      return {
        mode: 'mock',
        runtimeRef: `mock-runtime-${tenantId}`,
        status: 'running'
      };
    }

    try {
      const run = await this.client.send(
        new RunTaskCommand({
          cluster: config.aws.ecsCluster,
          taskDefinition: config.aws.ecsTaskDefinition,
          launchType: 'FARGATE',
          count: 1,
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: config.aws.ecsSubnets,
              securityGroups: config.aws.ecsSecurityGroups,
              assignPublicIp: 'ENABLED'
            }
          },
          overrides: {
            containerOverrides: [
              {
                name: 'app',
                environment: [
                  { name: 'TENANT_ID', value: tenantId }
                ]
              }
            ]
          },
          tags: [
            { key: 'tenant_id', value: tenantId },
            { key: 'service', value: 'cogniclaw-runtime' }
          ]
        })
      );

      const taskArn = run.tasks?.[0]?.taskArn || null;

      return {
        mode: 'aws-ecs',
        runtimeRef: taskArn,
        status: run.failures?.length ? 'error' : 'running',
        failures: run.failures || []
      };
    } catch (error) {
      logger.error('ecs.provision.failed', { tenantId, error: error.message });
      return {
        mode: 'aws-ecs',
        runtimeRef: null,
        status: 'error',
        error: error.message
      };
    }
  }

  async restartRuntime(serviceName) {
    if (!this.enabled()) {
      return { mode: 'mock', status: 'restarted' };
    }

    const result = await this.client.send(
      new UpdateServiceCommand({
        cluster: config.aws.ecsCluster,
        service: serviceName,
        forceNewDeployment: true
      })
    );

    return {
      mode: 'aws-ecs',
      status: result.service?.status || 'UPDATING'
    };
  }

  async checkHealth(serviceName) {
    if (!this.enabled()) {
      return { mode: 'mock', status: 'healthy' };
    }

    const result = await this.client.send(
      new DescribeServicesCommand({
        cluster: config.aws.ecsCluster,
        services: [serviceName]
      })
    );

    const service = result.services?.[0];
    const healthy = Boolean(service) && (service.runningCount || 0) > 0;
    return {
      mode: 'aws-ecs',
      status: healthy ? 'healthy' : 'degraded',
      runningCount: service?.runningCount || 0,
      desiredCount: service?.desiredCount || 0
    };
  }
}

module.exports = { EcsRuntimeAdapter };