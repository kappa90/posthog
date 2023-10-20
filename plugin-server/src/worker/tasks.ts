import { PluginEvent } from '@posthog/plugin-scaffold/src/types'

import { EnqueuedPluginJob, Hub, PluginTaskType } from '../types'
import { retryIfRetriable } from '../utils/retries'
import { status } from '../utils/status'
import { sleep } from '../utils/utils'
import { loadSchedule } from './plugins/loadSchedule'
import { runPluginTask, runProcessEvent } from './plugins/run'
import { setupPlugins } from './plugins/setup'
import { teardownPlugins } from './plugins/teardown'

type TaskRunner = (hub: Hub, args: any) => Promise<any> | any

export const workerTasks: Record<string, TaskRunner> = {
    runPluginJob: (hub, { job }: { job: EnqueuedPluginJob }) => {
        return runPluginTask(hub, job.type, PluginTaskType.Job, job.pluginConfigId, job.payload)
    },
    runEveryMinute: async (hub, args: { pluginConfigId: number }) => {
        return runPluginTask(hub, 'runEveryMinute', PluginTaskType.Schedule, args.pluginConfigId)
    },
    runEveryHour: (hub, args: { pluginConfigId: number }) => {
        return runPluginTask(hub, 'runEveryHour', PluginTaskType.Schedule, args.pluginConfigId)
    },
    runEveryDay: (hub, args: { pluginConfigId: number }) => {
        return runPluginTask(hub, 'runEveryDay', PluginTaskType.Schedule, args.pluginConfigId)
    },
    getPluginSchedule: (hub) => {
        return hub.pluginSchedule
    },
    pluginScheduleReady: (hub) => {
        return hub.pluginSchedule !== null
    },
    reloadPlugins: async (hub) => {
        // Jitter the reload time to avoid all workers reloading at the same time.
        const jitterMs = Math.random() * hub.RELOAD_PLUGIN_JITTER_MAX_MS
        status.info('💤', `Sleeping for ${jitterMs}ms to jitter reloadPlugins`)
        await sleep(jitterMs)
        await retryIfRetriable(async () => await setupPlugins(hub))
    },
    reloadSchedule: async (hub) => {
        await loadSchedule(hub)
    },
    teardownPlugins: async (hub) => {
        await teardownPlugins(hub)
    },
    flushKafkaMessages: async (hub) => {
        await hub.kafkaProducer.flush()
    },
    resetAvailableFeaturesCache: (hub, args: { organization_id: string }) => {
        hub.organizationManager.resetAvailableFeatureCache(args.organization_id)
    },
    // Exported only for tests
    _testsRunProcessEvent: async (hub, args: { event: PluginEvent }) => {
        return runProcessEvent(hub, args.event)
    },
}
