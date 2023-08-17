import './Plugins.scss'
import { useEffect, useState } from 'react'
import { PluginDrawer } from 'scenes/plugins/edit/PluginDrawer'
import { RepositoryTab } from 'scenes/plugins/tabs/repository/RepositoryTab'
import { InstalledTab } from 'scenes/plugins/tabs/installed/InstalledTab'
import { useActions, useValues } from 'kea'
import { pluginsLogic } from './pluginsLogic'
import { PageHeader } from 'lib/components/PageHeader'
import { PluginTab } from 'scenes/plugins/types'
import { AdvancedTab } from 'scenes/plugins/tabs/advanced/AdvancedTab'
import { canGloballyManagePlugins, canInstallPlugins, canViewPlugins } from './access'
import { userLogic } from 'scenes/userLogic'
import { SceneExport } from 'scenes/sceneTypes'
import { ActivityLog } from 'lib/components/ActivityLog/ActivityLog'
import { ActivityScope } from 'lib/components/ActivityLog/humanizeActivity'
import { LemonTag } from '@posthog/lemon-ui'
import { LemonTabs } from 'lib/lemon-ui/LemonTabs'
import { BatchExportsTab } from './tabs/batch-exports/BatchExportsTab'
import { AppsTab } from './tabs/apps/AppsTab'

export const scene: SceneExport = {
    component: AppsScene,
    logic: pluginsLogic,
}

export function AppsScene(): JSX.Element | null {
    const { user } = useValues(userLogic)

    const [tab, setTab] = useState('apps')

    useEffect(() => {
        if (!canViewPlugins(user?.organization)) {
            window.location.href = '/'
        }
    }, [user])

    if (!user || !canViewPlugins(user?.organization)) {
        return null
    }

    return (
        <>
            <PageHeader title="Apps & Exports" tabbedPage />
            <LemonTabs
                data-attr="apps-tabs"
                activeKey={tab}
                onChange={(newKey) => setTab(newKey)}
                tabs={[
                    { key: 'apps', label: 'Apps', content: <AppsTab /> },
                    { key: 'batch_exports', label: 'Batch Exports', content: <BatchExportsTab /> },
                    {
                        key: 'history',
                        label: 'History',
                        content: <ActivityLog scope={ActivityScope.PLUGIN} />,
                    },
                ]}
            />
        </>
    )
}
