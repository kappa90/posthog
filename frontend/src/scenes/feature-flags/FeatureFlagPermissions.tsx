import { IconGear, IconTrash } from '@posthog/icons'
import { LemonButton, LemonTable } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { PayGateMini } from 'lib/components/PayGateMini/PayGateMini'
import { TitleWithIcon } from 'lib/components/TitleWithIcon'
import { useFeatureFlag } from 'lib/hooks/useFeatureFlag'
import {
    LemonSelectMultiple,
    LemonSelectMultipleOptionItem,
} from 'lib/lemon-ui/LemonSelectMultiple/LemonSelectMultiple'
import { LemonTableColumns } from 'lib/lemon-ui/LemonTable'

import { AccessControlObject } from '~/layout/navigation-3000/sidepanel/panels/access_control/AccessControlObject'
import { AccessLevel, AvailableFeature, FeatureFlagType, Resource, RoleType } from '~/types'

import {
    FormattedResourceLevel,
    permissionsLogic,
    ResourcePermissionMapping,
} from '../settings/organization/Permissions/permissionsLogic'
import { rolesLogic } from '../settings/organization/Permissions/Roles/rolesLogic'
import { urls } from '../urls'
import { featureFlagPermissionsLogic } from './featureFlagPermissionsLogic'

interface ResourcePermissionProps {
    addableRoles: RoleType[]
    addableRolesLoading: boolean
    onChange: (newValue: string[]) => void
    rolesToAdd: string[]
    onAdd: () => void
    roles: RoleType[]
    deleteAssociatedRole: (id: RoleType['id']) => void
    resourceType: Resource
    canEdit: boolean
}

function roleLemonSelectOptions(roles: RoleType[]): LemonSelectMultipleOptionItem[] {
    return roles.map((role) => ({
        key: role.id,
        label: `${role.name}`,
        labelComponent: (
            <span>
                <b>{`${role.name}`}</b>
            </span>
        ),
    }))
}

export function FeatureFlagPermissions({ featureFlag }: { featureFlag: FeatureFlagType }): JSX.Element {
    const { addableRoles, unfilteredAddableRolesLoading, rolesToAdd, derivedRoles } = useValues(
        featureFlagPermissionsLogic({ flagId: featureFlag.id })
    )
    const { setRolesToAdd, addAssociatedRoles, deleteAssociatedRole } = useActions(
        featureFlagPermissionsLogic({ flagId: featureFlag.id })
    )

    const newAccessControls = useFeatureFlag('ACCESS_CONTROL')

    if (newAccessControls) {
        if (!featureFlag.id) {
            return <p>Not supported</p>
        }
        return <AccessControlObject resource="feature_flag" resource_id={`${featureFlag.id}`} />
    }

    return (
        <PayGateMini feature={AvailableFeature.ROLE_BASED_ACCESS}>
            <ResourcePermission
                resourceType={Resource.FEATURE_FLAGS}
                onChange={(roleIds) => setRolesToAdd(roleIds)}
                rolesToAdd={rolesToAdd}
                addableRoles={addableRoles}
                addableRolesLoading={unfilteredAddableRolesLoading}
                onAdd={() => addAssociatedRoles()}
                roles={derivedRoles}
                deleteAssociatedRole={(id) => deleteAssociatedRole({ roleId: id })}
                canEdit={featureFlag.can_edit}
            />
        </PayGateMini>
    )
}

export function ResourcePermission({
    rolesToAdd,
    addableRoles,
    onChange,
    addableRolesLoading,
    onAdd,
    roles,
    deleteAssociatedRole,
    resourceType,
    canEdit,
}: ResourcePermissionProps): JSX.Element {
    const { allPermissions, shouldShowPermissionsTable } = useValues(permissionsLogic)
    const { roles: possibleRolesWithAccess } = useValues(rolesLogic)
    const resourceLevel = allPermissions.find((permission) => permission.resource === resourceType)
    // TODO: feature_flag_access_level should eventually be generic in this component
    const rolesWithAccess = possibleRolesWithAccess.filter(
        (role) => role.feature_flags_access_level === AccessLevel.WRITE
    )
    interface TableRoleType extends RoleType {
        deletable?: boolean
    }

    const columns: LemonTableColumns<TableRoleType> = [
        {
            title: 'Role',
            dataIndex: 'name',
            key: 'name',
            render: function RenderRoleName(_, role) {
                return (
                    <>
                        {role.name === 'Organization default' ? (
                            <TitleWithIcon
                                icon={
                                    <LemonButton
                                        icon={<IconGear />}
                                        to={`${urls.settings('organization')}?tab=role_based_access`}
                                        targetBlank
                                        size="small"
                                        noPadding
                                        tooltip="Organization-wide permissions for roles can be managed in the organization settings."
                                        className="ml-1"
                                    />
                                }
                            >
                                All users by default
                            </TitleWithIcon>
                        ) : (
                            role.name
                        )}
                    </>
                )
            },
        },
        {
            title: 'Access',
            dataIndex: 'feature_flags_access_level',
            key: 'feature_flags_access_level',
            render: function RenderAccessLevel(_, role) {
                return (
                    <div className="flex flex-row justify-between">
                        {role.feature_flags_access_level === AccessLevel.WRITE ? 'Edit' : 'View'}
                        {role.deletable && (
                            <LemonButton
                                icon={<IconTrash />}
                                onClick={() => deleteAssociatedRole(role.id)}
                                tooltip="Remove custom role from feature flag"
                                tooltipPlacement="bottom-start"
                                size="small"
                            />
                        )}
                    </div>
                )
            },
        },
    ]
    const tableData: TableRoleType[] = [
        {
            id: '',
            name: 'Organization default',
            feature_flags_access_level: resourceLevel ? resourceLevel.access_level : AccessLevel.WRITE,
            created_by: null,
            created_at: '',
        } as TableRoleType,
        ...rolesWithAccess,
        ...roles.map((role) => ({ ...role, feature_flags_access_level: AccessLevel.WRITE, deletable: true })), // associated flag roles with custom write access
    ]

    return (
        <>
            {!shouldShowPermissionsTable && (
                <>
                    {resourceLevel && <OrganizationResourcePermissionLabel resourceLevel={resourceLevel} />}
                    <OrganizationResourcePermissionRoles roles={rolesWithAccess} />
                </>
            )}
            {shouldShowPermissionsTable && <LemonTable dataSource={tableData} columns={columns} className="mt-4" />}
            {!shouldShowPermissionsTable && (
                <>
                    <h5 className="mt-4">Roles</h5>
                    {roles.length > 0 ? (
                        <div className="pb-2 rounded overflow-y-auto max-h-80">
                            {roles.map((role) => {
                                return (
                                    <RoleRow
                                        key={role.id}
                                        role={role}
                                        deleteRole={(roleId) => deleteAssociatedRole(roleId)}
                                    />
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-muted mb-2">No roles added yet</div>
                    )}
                </>
            )}
            {canEdit && (
                <>
                    <h5 className="mt-4">Custom edit roles</h5>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <LemonSelectMultiple
                                placeholder="Search for roles to add…"
                                loading={addableRolesLoading}
                                onChange={onChange}
                                value={rolesToAdd}
                                filterOption={true}
                                mode="multiple"
                                data-attr="resource-permissioning-select"
                                options={roleLemonSelectOptions(addableRoles)}
                            />
                        </div>
                        <LemonButton type="primary" loading={false} disabled={rolesToAdd.length === 0} onClick={onAdd}>
                            Add
                        </LemonButton>
                    </div>
                </>
            )}
        </>
    )
}

function OrganizationResourcePermissionLabel({
    resourceLevel,
}: {
    resourceLevel: FormattedResourceLevel
}): JSX.Element {
    return (
        <>
            <TitleWithIcon
                icon={
                    <LemonButton
                        icon={<IconGear />}
                        to={`${urls.settings('organization')}?tab=role_based_access`}
                        targetBlank
                        size="small"
                        noPadding
                        className="ml-1"
                    />
                }
            >
                <h5>Organization default</h5>
            </TitleWithIcon>
            <b>{ResourcePermissionMapping[resourceLevel.access_level]}</b>
        </>
    )
}

function OrganizationResourcePermissionRoles({ roles }: { roles: RoleType[] }): JSX.Element {
    return (
        <>
            <h5 className="mt-4">Roles with edit access</h5>
            <div className="flex">
                {roles.map((role) => (
                    <span key={role.id} className="simple-tag tag-light-blue text-primary-alt mr-2">
                        <b>{role.name}</b>{' '}
                    </span>
                ))}
            </div>
        </>
    )
}

function RoleRow({ role, deleteRole }: { role: RoleType; deleteRole?: (roleId: RoleType['id']) => void }): JSX.Element {
    return (
        <div className="flex items-center justify-between h-8">
            <b>{role.name}</b>
            {deleteRole && (
                <LemonButton
                    icon={<IconTrash />}
                    onClick={() => deleteRole(role.id)}
                    tooltip="Remove role from permission"
                    tooltipPlacement="bottom-start"
                    size="small"
                />
            )}
        </div>
    )
}